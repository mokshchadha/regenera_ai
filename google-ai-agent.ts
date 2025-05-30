import {
  GenerationConfig,
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
  Part,
  Tool,
} from "@google/generative-ai";

interface AgentOptions {
  name: string;
  instruction: string;
  description: string;
  isGoogleSearchEnabled: boolean;
  model?: string;
  tools?: Array<Tool>; // Type can be refined based on actual tool structure
  files?: Array<File | string>;
  modelConfig?: GenerationConfig;
}

interface AgentResponse {
  text: string;
  toolCalls?: Array<Tool>;
  files?: Array<File | string>;
}

export class GoogleAIAgent {
  private apiKey: string;
  public modelName: string = "gemini-2.0-flash";
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string, modelName?: string) {
    if (!apiKey) {
      throw new Error("API key is required");
    }

    this.apiKey = apiKey;
    if (modelName) {
      this.modelName = modelName;
    }

    this.genAI = new GoogleGenerativeAI(this.apiKey);
  }

  agent(options: AgentOptions) {
    if (!options.name || !options.instruction) {
      throw new Error("Agent name and instruction are required");
    }
    const config = options.modelConfig ?? {};

    const model = this.genAI.getGenerativeModel({
      model: options.model ?? this.modelName,
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        topK: 64,
        ...config,
      },
    });

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{
            text:
              `System: You are an AI assistant named ${options.name}. ${options.instruction}.`,
          }],
        },
        {
          role: "model",
          parts: [{
            text: `I understand. I am ${options.name}, and I will ${
              options.description || "assist you as instructed"
            }.`,
          }],
        },
      ],
      tools: options.tools || [],
    });

    return async (query: string | Part[]): Promise<AgentResponse> => {
      try {
        let parts: Part[] = [];

        if (typeof query === "string") {
          parts = [{ text: query }];
        } else {
          parts = query;
        }

        if (options.files && options.files.length > 0) {
          for (const file of options.files) {
            if (typeof file === "string") {
              throw new Error(
                "File paths not supported in browser environments",
              );
            } else if (file instanceof File) {
              const fileData = await this.fileToGenerativePart(file);
              if (fileData) parts.push(fileData);
            }
          }
        }

        const result = await chat.sendMessage(parts);
        const response = result.response;
        const text = response.text();

        // const toolCalls = response.candidates?.[0]?.content?.parts
        //   ?.filter((part: { functionCall: string; }) => part.functionCall)
        //   .map((part: { functionCall: string; }) => part.functionCall);

        return {
          text,
          //   toolCalls: toolCalls || [],
          //   files: response.candidates?.[0]?.content?.parts
          //     ?.filter((part: { fileData: string; }) => part.fileData)
          //     .map((part: { fileData: string; }) => part.fileData) || [],
        };
      } catch (error) {
        console.error("Error processing query:", error);
        throw error;
      }
    };
  }

  private async fileToGenerativePart(file: File): Promise<Part | null> {
    try {
      const data = await file.arrayBuffer();
      const mimeType = this.getMimeType(file.name);
      if (!mimeType) {
        console.warn(`Unsupported file type: ${file.name}`);
        return null;
      }
      return {
        inlineData: {
          data: this.arrayBufferToBase64(data),
          mimeType,
        },
      };
    } catch (error) {
      console.error("Error converting file to GenerativePart:", error);
      return null;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  }

  private getMimeType(filename: string): string | null {
    const extension = filename.split(".").pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      "jpg": "image/jpeg",
      "jpeg": "image/jpeg",
      "png": "image/png",
      "gif": "image/gif",
      "webp": "image/webp",
      "pdf": "application/pdf",
      "txt": "text/plain",
      "html": "text/html",
      "csv": "text/csv",
      "json": "application/json",
      "mp3": "audio/mpeg",
      "mp4": "video/mp4",
      "webm": "video/webm",
    };

    return extension && extension in mimeTypes ? mimeTypes[extension] : null;
  }
}
