require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const archiver = require('archiver');
const { Worker } = require('worker_threads');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'text/csv') {
            return cb(new Error('Only CSV files are allowed'));
        }
        cb(null, true);
    }
});

// Ensure required directories exist
['uploads', 'downloads', 'public'].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
});

// Worker pool for parallel processing
class WorkerPool {
    constructor(size) {
        this.size = size;
        this.workers = [];
        this.queue = [];
    }

    addTask(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    processQueue() {
        while (this.workers.length < this.size && this.queue.length > 0) {
            const { task, resolve, reject } = this.queue.shift();
            const worker = new Worker('./worker.js');
            
            worker.on('message', (result) => {
                resolve(result);
                this.workers = this.workers.filter(w => w !== worker);
                worker.terminate();
                this.processQueue();
            });

            worker.on('error', (error) => {
                reject(error);
                this.workers = this.workers.filter(w => w !== worker);
                worker.terminate();
                this.processQueue();
            });

            this.workers.push(worker);
            worker.postMessage(task);
        }
    }
}

const workerPool = new WorkerPool(4); // Create 4 workers

// Handle file upload
app.post('/upload', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'baseUrl', maxCount: 1 }
]), async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const uploadedFile = req.files.file[0];
        console.log('Processing uploaded file:', uploadedFile.path);
        const words = await new Promise((resolve, reject) => {
            const results = [];
            fs.createReadStream(uploadedFile.path)
                .pipe(parse({ 
                    delimiter: ',',
                    skip_empty_lines: true,
                    trim: true
                }))
                .on('data', (data) => {
                    // Filter out empty strings and add non-empty words
                    results.push(...data.filter(word => word.trim()));
                })
                .on('end', () => {
                    console.log('Parsed words:', results);
                    resolve(results);
                })
                .on('error', reject);
        });

        // Create a unique download directory
        const downloadDir = path.join('downloads', Date.now().toString());
        fs.mkdirSync(downloadDir, { recursive: true });
        console.log('Created download directory:', downloadDir);

        // Get baseUrl from form data
        const baseUrl = req.body.baseUrl || '';
        console.log('Using base URL:', baseUrl);

        // Process each word with worker pool
        const tasks = words.map(word => ({
            word,
            downloadDir,
            baseUrl // Pass the custom baseUrl to the worker
        }));

        console.log('Starting to process tasks...');
        const results = await Promise.allSettled(
            tasks.map(task => workerPool.addTask(task))
        );

        // Create zip file
        const zipPath = path.join('public', `icons-${Date.now()}.zip`);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('error', reject);
            archive.pipe(output);
            archive.directory(downloadDir, false);
            archive.finalize();
        });

        // Cleanup
        fs.rmSync(uploadedFile.path);
        fs.rmSync(downloadDir, { recursive: true });
        
        console.log('Processing complete. Sending response...');
        res.json({
            success: true,
            downloadUrl: `/${path.basename(zipPath)}`,
            processedWords: results.length,
            errors: results
                .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success))
                .map(r => r.status === 'rejected' ? r.reason.message : r.value.error)
        });

    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear all downloads and uploads
app.post('/clear', (req, res) => {
    try {
        // Clear uploads directory
        if (fs.existsSync('uploads')) {
            fs.readdirSync('uploads').forEach(file => {
                fs.rmSync(path.join('uploads', file), { force: true });
            });
        }

        // Clear downloads directory
        if (fs.existsSync('downloads')) {
            fs.readdirSync('downloads').forEach(file => {
                fs.rmSync(path.join('downloads', file), { recursive: true, force: true });
            });
        }

        // Clear zip files from public directory
        if (fs.existsSync('public')) {
            fs.readdirSync('public').forEach(file => {
                if (file.endsWith('.zip')) {
                    fs.rmSync(path.join('public', file), { force: true });
                }
            });
        }

        res.json({ success: true, message: 'All files cleared successfully' });
    } catch (error) {
        console.error('Error clearing files:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
