import { Anthropic } from "@anthropic-ai/sdk";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("Please set ANTHROPIC_API_KEY in your .env file");
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey,
});

async function listModels() {
  try {
    const models = await anthropic.models.list();
    console.log("Available models:");
    models.data.forEach((model) => {
      console.log(`- ${model.id}`);
    });
  } catch (error) {
    console.error("Error fetching models:", error);
  }
}

listModels();
