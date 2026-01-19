export const analyzeFaceMatch = async (base64Image) => {
    const apiKey = localStorage.getItem('gemini_api_key') || 'AIzaSyDGK_BlHcmaFaFPiKK390m7No19PkKByUM'; // Fallback or User Key

    if (!apiKey) {
        throw new Error("API Key is missing via implementation.");
    }

    const rawBase64 = base64Image.split(',')[1];

    const systemPrompt = `
  You are an expert football (soccer) analyst.
  Analyze the facial features of the person in this image.
  Identify which famous footballer they arguably look most similar to.
  Return a JSON object with this EXACT structure (no markdown, just raw json):
  {
      "playerName": "Name of Footballer",
      "similarityScore": 85, 
      "club": "Current Club",
      "position": "Position (e.g. Forward)",
      "reasoning": "Short 1 sentence explanation of why.",
      "stats": {
          "appearances": "100+",
          "goals": "50+",
          "assists": "30+"
      },
      "playerImageUrls": [
          "https://example.com/placeholder.jpg"
      ]
  }
  If no face is detected, return { "error": "No face detected" }.
  `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: systemPrompt },
                        { inline_data: { mime_type: "image/jpeg", data: rawBase64 } }
                    ]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.candidates || !data.candidates[0].content) {
            throw new Error("No analysis result returned.");
        }

        const text = data.candidates[0].content.parts[0].text;
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(jsonStr);

        if (result.error) throw new Error(result.error);

        // Add mock image URLs if Gemini doesn't provide them (it usually doesn't provide valid external URLs)
        // We will rely on the Transfermarkt search in the UI for real images
        result.playerImageUrls = [];

        return result;

    } catch (err) {
        console.error("Gemini API Error", err);
        throw err;
    }
};
