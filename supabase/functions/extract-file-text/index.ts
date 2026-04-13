import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { filePath, fileName } = await req.json();
    if (!filePath || !fileName) {
      return new Response(JSON.stringify({ error: "filePath and fileName are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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
      extractedText = extractPdfText(new Uint8Array(buffer), fileName);
    } else if (ext === "docx" || ext === "doc") {
      const buffer = await fileData.arrayBuffer();
      extractedText = extractDocxText(new Uint8Array(buffer), fileName);
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

    // Truncate to ~15k chars
    if (extractedText.length > 15000) {
      extractedText = extractedText.slice(0, 15000) + "\n\n[... text truncated at 15,000 characters]";
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

function extractPdfText(bytes: Uint8Array, fileName: string): string {
  try {
    const text = new TextDecoder("latin1").decode(bytes);
    const textParts: string[] = [];
    const regex = /\(([^)]*)\)/g;
    let match;

    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(text)) !== null) {
      const content = streamMatch[1];
      while ((match = regex.exec(content)) !== null) {
        const decoded = match[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\([()])/g, "$1");
        if (decoded.trim().length > 0) textParts.push(decoded);
      }
    }

    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    while ((match = tjRegex.exec(text)) !== null) {
      const decoded = match[1].replace(/\\([()])/g, "$1");
      if (decoded.trim().length > 0 && !textParts.includes(decoded)) textParts.push(decoded);
    }

    if (textParts.length > 0) {
      return `[Extracted from PDF: ${fileName}]\n\n${textParts.join(" ")}`;
    }
    return `[PDF file: ${fileName} - Text extraction limited. The document may contain scanned images.]`;
  } catch {
    return `[PDF file: ${fileName} - Could not extract text content.]`;
  }
}

function extractDocxText(bytes: Uint8Array, fileName: string): string {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const parts: string[] = [];
    let match;
    while ((match = wtRegex.exec(text)) !== null) {
      if (match[1].trim()) parts.push(match[1]);
    }
    if (parts.length > 0) {
      return `[Extracted from DOCX: ${fileName}]\n\n${parts.join(" ")}`;
    }
    const readable = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const cleaned = readable.replace(/[^\x20-\x7E\n]/g, "").trim();
    if (cleaned.length > 50) {
      return `[Extracted from DOCX: ${fileName}]\n\n${cleaned.slice(0, 15000)}`;
    }
    return `[DOCX file: ${fileName} - Limited text extraction.]`;
  } catch {
    return `[DOCX file: ${fileName} - Could not extract text content.]`;
  }
}
