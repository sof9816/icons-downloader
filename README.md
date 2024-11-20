# Icon Downloader

A web application that processes CSV files containing words and downloads relevant icons for each word. Built with Node.js and Express.

## Features

- CSV file upload and processing
- Automated icon search and download
- Multithreaded processing using Worker Threads
- Organized folder structure for downloaded icons
- Automatic ZIP file creation
- Progress tracking and error handling
- Responsive web interface
- Drag and drop file upload

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd IconDownloader
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Upload a CSV file containing words (one word per column)
3. The application will:
   - Process the CSV file
   - Search for icons for each word
   - Download the first two icons found for each word
   - Organize icons in folders named after each word
   - Create a ZIP file containing all downloaded icons
4. Download the ZIP file when processing is complete

## Project Structure

```
IconDownloader/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   └── upload-icon.svg
├── server.js
├── worker.js
├── package.json
└── README.md
```

## API Endpoints

- `POST /upload`: Accepts CSV file upload and returns download URL for the ZIP file
  - Request: multipart/form-data with 'file' field containing CSV
  - Response: JSON with download URL and processing statistics

## Error Handling

The application includes comprehensive error handling for:
- Invalid file types
- Network issues during icon downloads
- Processing errors
- API rate limits

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.
