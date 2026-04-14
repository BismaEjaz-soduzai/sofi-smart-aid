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

    const { data: fileRecord, error: fileRecordError } = await supabase
      .from("study_files")
      .select("id")
      .eq("user_id", user.id)
      .eq("file_path", filePath)
      .maybeSingle();

    if (fileRecordError || !fileRecord) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file from storage
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

    if (extractedText.length > 40000) {
      extractedText = extractedText.slice(0, 40000) + "\n\n[... text truncated at 40,000 characters]";
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return `[PDF file: ${fileName} - File is too large to preview reliably.]`;
    }

    const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
    const cleaned = normalizeText(text || "");
    if (cleaned.length > 0) {
      return `[Extracted from PDF: ${fileName}]\n\n${cleaned}`;
    }
    return `[PDF file: ${fileName} - Text extraction limited. The document may contain scanned images.]`;
  } catch {
    return `[PDF file: ${fileName} - Could not extract text content.]`;
  }
}

async function extractDocxText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")?.async("string");
    if (!documentXml) return `[DOCX file: ${fileName} - Document structure not found.]`;

    const parts = [...documentXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
      .map((match) => decodeXml(match[1]))
      .filter((part) => part.trim().length > 0);

    if (parts.length > 0) {
      return `[Extracted from DOCX: ${fileName}]\n\n${normalizeText(parts.join(" "))}`;
    }

    return `[DOCX file: ${fileName} - Limited text extraction.]`;
  } catch {
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

    for (const slideName of slideNames) {
      const xml = await zip.file(slideName)?.async("string");
      if (!xml) continue;

      const textParts = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
        .map((match) => decodeXml(match[1]))
        .filter((part) => part.trim().length > 0);

      if (textParts.length > 0) {
        slides.push(textParts.join(" "));
      }
    }

    if (slides.length > 0) {
      return `[Extracted from PPTX: ${fileName}]\n\n${normalizeText(slides.map((slide, index) => `Slide ${index + 1}: ${slide}`).join("\n\n"))}`;
    }

    return `[PPTX file: ${fileName} - No readable slide text was found.]`;
  } catch {
    return `[PPTX file: ${fileName} - Could not extract slide text.]`;
  }
}
