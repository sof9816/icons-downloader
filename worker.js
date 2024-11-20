const { parentPort } = require("worker_threads");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

async function downloadImage(url, filepath) {
  const response = await axios({
    url,
    responseType: "stream",
  });

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filepath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function searchIcons(word, baseUrl) {
  try {
    // Use custom baseUrl if provided, otherwise use default Noun Project URL
    const searchUrl = baseUrl ? 
      `${baseUrl}${encodeURIComponent(word)}` : 
      `https://thenounproject.com/search/icons/?q=${encodeURIComponent(word)}`;
      
    console.log(`Searching icons for word: ${word} at URL: ${searchUrl}`);
    
    const response = await axios.get(searchUrl);
    const $ = cheerio.load(response.data);

    // Updated selector for The Noun Project website
    const icons = $("img")
      .map((_, el) => {
        const src = $(el).attr("src");
        // Only get SVG or PNG icons
        if (src && (src.includes('.svg') || src.includes('.png'))) {
          return src;
        }
      })
      .get()
      .filter(Boolean)
      .slice(0, 2); // Get first 2 icons

    console.log(`Found ${icons.length} icons for word: ${word}`);
    return icons;
  } catch (error) {
    console.error(`Error searching icons for ${word}:`, error.message);
    throw new Error(`Failed to search icons for ${word}: ${error.message}`);
  }
}

parentPort.on("message", async ({ word, downloadDir, baseUrl }) => {
  try {
    console.log(`Processing word: ${word}`);
    const wordDir = path.join(downloadDir, word.trim());
    fs.mkdirSync(wordDir, { recursive: true });

    const icons = await searchIcons(word, baseUrl);

    if (icons.length === 0) {
      // Remove directory if no icons found
      fs.rmSync(wordDir, { recursive: true, force: true });
      throw new Error(`No icons found for ${word}`);
    }

    console.log(`Downloading ${icons.length} icons for ${word}`);
    try {
      await Promise.all(
        icons.map(async (iconUrl, index) => {
          const ext = path.extname(iconUrl) || ".png";
          const filepath = path.join(wordDir, `icon${index + 1}${ext}`);
          console.log(`Downloading icon ${index + 1} to ${filepath}`);
          await downloadImage(iconUrl, filepath);
        })
      );
    } catch (error) {
      // Remove directory if any download fails
      fs.rmSync(wordDir, { recursive: true, force: true });
      throw error;
    }

    parentPort.postMessage({ success: true, word });
  } catch (error) {
    console.error(`Error processing ${word}:`, error.message);
    parentPort.postMessage({
      success: false,
      word,
      error: error.message,
    });
  }
});
