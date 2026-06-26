const ANTHROPIC_KEY = Deno.env.get("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 ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    var body = await req.json();
    var word = body.word ?? "";
    var transcript = body.transcript ?? "";

    if (!word || !transcript) {
      return Response.json({ error: "Faltando word ou transcript" }, { status: 400 });
    }

    var prompt = "You are an English phonics teacher. Target word: \"" + word + "\". Student said: \"" + transcript + "\". Did they say the word correctly? Respond ONLY with this exact JSON, no markdown: {\"correct\": true, \"feedback\": \"Muito bem!\"}";

    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    var data = await res.json();
    var raw = data.content?.[0]?.text ?? "";
    var match = raw.match(/\{[\s\S]*\}/);
    var result = match
      ? JSON.parse(match[0])
      : { correct: false, feedback: "Não foi possível avaliar. Tente novamente." };

    return Response.json(result, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });

  } catch (e) {
    return Response.json(
      { error: e.message },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
});
