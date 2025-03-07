import { NextResponse } from "next/server";
import { exec } from "child_process";

export async function POST(req: Request) {
  console.log("=== [OLLAMA API] Incoming POST request ===");

  // Log environment info for debugging
  console.log("Environment PATH:", process.env.PATH);
  console.log("Current working directory:", process.cwd());

  // Attempt to see if Node can find Ollama with 'which ollama'
  exec("which ollama", { shell: true }, (err, stdout, stderr) => {
    if (err) {
      console.error("Error running 'which ollama':", err);
    } else {
      console.log("which ollama =>", stdout.trim());
    }
    if (stderr) {
      console.error("stderr from 'which ollama':", stderr);
    }
  });

  try {
    // Parse the JSON body to get the prompt
    const body = await req.json();
    console.log("Parsed request body:", body);

    const prompt: string | undefined = body?.prompt;
    console.log("Received prompt:", prompt);

    if (!prompt) {
      console.log("No prompt provided in request body");
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    // 1) Path to Ollama (from your 'which ollama' logs)
    const ollamaPath = "/usr/local/bin/ollama";
    console.log("Using Ollama path:", ollamaPath);

    // 2) We build a single string command for 'exec':
    //    e.g. /usr/local/bin/ollama run llama3.2 "<prompt>"
    //    Adjust the model if you want a smaller one, like 'llama2'
    const command = `${ollamaPath} run llama3.2 "${prompt}"`;
    console.log("Exec command:", command);

    // 3) Exec call with shell: true
    return new Promise((resolve) => {
      exec(command, { shell: true }, (error, stdout, stderr) => {
        console.log("=== [OLLAMA API] Inside exec callback ===");

        if (error) {
          console.error("Exec error:", error);
          return resolve(
            NextResponse.json({ error: error.message }, { status: 500 })
          );
        }

        if (stderr) {
          console.log("stderr from Ollama:", stderr);
        }

        console.log("stdout from Ollama:", stdout);

        // Return the final output
        resolve(NextResponse.json({ response: stdout.trim() }));
      });
    });
  } catch (error: any) {
    console.log("=== [OLLAMA API] Caught an error in try/catch ===");
    console.error("Error in Ollama route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
