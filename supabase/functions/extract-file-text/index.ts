import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractText } from "https://esm.sh/unpdf@1.0.4";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { filePath, fileName } = await req.json();
    if (!filePath || !fileName) {
      return new Response(JSON.stringify({ error: "filePath and fileName are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Allow file owner OR a room member (workspace shared room) to read.
    const { data: fileRecord, error: fileRecordError } = await supabase
      .from("study_files")
      .select("id, user_id, room_id")
      .eq("file_path", filePath)
      .maybeSingle();

    if (fileRecordError || !fileRecord) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (fileRecord.user_id !== user.id) {
      // Check shared room access
      let allowed = false;
      if (fileRecord.room_id) {
        const { data: member } = await supabase
          .from("workspace_room_members")
          .select("id")
          .eq("room_id", fileRecord.room_id)
          .eq("user_id", user.id)
          .maybeSingle();
        if (member) allowed = true;
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("study-files")
      .download(filePath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: "Could not download file", detail: downloadError?.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    let extractedText = "";

    if (["txt", "md", "csv", "json", "xml", "html", "css", "js", "ts", "py", "text"].includes(ext)) {
      extractedText = await fileData.text();
    } else if (ext === "pdf") {
      const buffer = await fileData.arrayBuffer();
      extractedText = await extractPdfText(buffer, fileName);
    } else if (ext === "docx") {
      const buffer = await fileData.arrayBuffer();
      extractedText = await extractDocxText(buffer, fileName);
    } else if (ext === "pptx") {
      const buffer = await fileData.arrayBuffer();
      extractedText = await extractPptxText(buffer, fileName);
    } else {
      try {
        const text = await fileData.text();
        if (text && text.length > 10 && !text.includes("\0")) {
          extractedText = text;
        } else {
          extractedText = `[Unsupported file type: ${ext}]`;
        }
      } catch {
        extractedText = `[Could not extract text from ${fileName}]`;
      }
    }

    extractedText = normalizeText(extractedText);

    if (extractedText.length > 60000) {
      extractedText = extractedText.slice(0, 60000) + "\n\n[... text truncated at 60,000 characters]";
    }

    return new Response(JSON.stringify({ text: extractedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-file-text error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function stripXmlTags(value: string) {
  return value.replace(/<[^>]+>/g, " ");
}

async function extractPdfText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return `[PDF file: ${fileName} - File is too large to preview reliably.]`;
    }
    // Per-page extraction so we can insert page markers
    const result = await extractText(new Uint8Array(buffer), { mergePages: false });
    const pages: string[] = Array.isArray(result.text) ? result.text : [String(result.text || "")];
    const blocks = pages
      .map((page, idx) => {
        const cleaned = normalizeText(page || "");
        if (!cleaned) return "";
        return `## Page ${idx + 1}\n\n${cleaned}`;
      })
      .filter(Boolean);
    if (blocks.length > 0) {
      return blocks.join("\n\n---\n\n");
    }
    return `[PDF file: ${fileName} - Text extraction limited. The document may contain scanned images.]`;
  } catch {
    return `[PDF file: ${fileName} - Could not extract text content.]`;
  }
}

/**
 * Walk a single <w:p> paragraph and emit a markdown line:
 * - Heading1/2/3 → # / ## / ###
 * - List items (numPr present) → "- " bullet
 * - Plain text otherwise
 */
function paragraphToMarkdown(paraXml: string): string {
  const styleMatch = paraXml.match(/<w:pStyle[^>]*w:val="([^"]+)"/);
  const style = styleMatch?.[1] || "";
  const isList = /<w:numPr\b/.test(paraXml);

  const parts = [...paraXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((m) => stripXmlTags(decodeXml(m[1])))
    .filter((p) => p.length > 0);

  // Preserve tabs as spaces, lines with only whitespace become empty
  const text = parts.join("").replace(/\s+/g, " ").trim();
  if (!text) return "";

  if (/^Heading1$/i.test(style) || /^Title$/i.test(style)) return `# ${text}`;
  if (/^Heading2$/i.test(style)) return `## ${text}`;
  if (/^Heading3$/i.test(style)) return `### ${text}`;
  if (/^Heading[4-9]$/i.test(style)) return `#### ${text}`;
  if (isList) return `- ${text}`;
  return text;
}

async function extractDocxText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) return `[DOCX file: ${fileName} - Document structure not found.]`;

    // Split on paragraph open tags
    const paragraphs = documentXml.split(/(?=<w:p[\s>])/g);
    const lines: string[] = [];
    for (const para of paragraphs) {
      const md = paragraphToMarkdown(para);
      if (md) lines.push(md);
      else if (lines.length && lines[lines.length - 1] !== "") lines.push("");
    }

    if (lines.length > 0) {
      return normalizeText(lines.join("\n"));
    }

    return `[DOCX file: ${fileName} - Limited text extraction.]`;
  } catch (e) {
    console.error("DOCX extract error", e);
    return `[DOCX file: ${fileName} - Could not extract text content.]`;
  }
}

async function extractPptxText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(a.match(/slide(\d+)\.xml/)?.[1] || 0) - Number(b.match(/slide(\d+)\.xml/)?.[1] || 0));

    const slides: string[] = [];

    for (let i = 0; i < slideNames.length; i++) {
      const xml = await zip.file(slideNames[i])?.async("string");
      if (!xml) continue;

      // Each <a:p> is a paragraph (which may be a title or bullet)
      const paragraphs = xml.split(/(?=<a:p[\s>])/g);
      const slideLines: string[] = [];
      let titleFound = false;

      for (const p of paragraphs) {
        const parts = [...p.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
          .map((m) => stripXmlTags(decodeXml(m[1])))
          .filter((part) => part.length > 0);
        const text = parts.join("").replace(/\s+/g, " ").trim();
        if (!text) continue;

        // First non-empty paragraph of the slide → title
        if (!titleFound) {
          slideLines.push(`## Slide ${i + 1}: ${text}`);
          titleFound = true;
        } else {
          slideLines.push(`- ${text}`);
        }
      }

      if (!titleFound) {
        slideLines.push(`## Slide ${i + 1}`);
      }

      slides.push(slideLines.join("\n"));
    }

    if (slides.length > 0) {
      return slides.join("\n\n---\n\n");
    }

    return `[PPTX file: ${fileName} - No readable slide text was found.]`;
  } catch (e) {
    console.error("PPTX extract error", e);
    return `[PPTX file: ${fileName} - Could not extract slide text.]`;
  }
}
