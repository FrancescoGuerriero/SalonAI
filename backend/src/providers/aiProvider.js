function mode() {
  return String(
    process.env.AI_PROVIDER_MODE || "local"
  ).toLowerCase();
}

export async function generateText({
  system,
  prompt,
  fallback,
}) {
  if (
    mode() === "local" ||
    !process.env.AI_ENDPOINT ||
    !process.env.AI_API_KEY
  ) {
    return {
      provider: "local",
      text: fallback,
    };
  }

  const response = await fetch(process.env.AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL,
      system,
      prompt,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `AI provider returned ${response.status}.`
    );
  }

  const payload = await response.json();

  return {
    provider: "remote",
    text:
      payload.text ||
      payload.output_text ||
      payload.message ||
      fallback,
    raw: payload,
  };
}
