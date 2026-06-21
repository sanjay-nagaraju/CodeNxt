import { NextResponse } from "next/server";
import { getModelInfo } from "@/lib/llm/model";

export async function GET() {
  const info = getModelInfo();
  return NextResponse.json(info);
}
