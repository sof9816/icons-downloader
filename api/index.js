const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const archiver = require('archiver');
const { Worker } = require('worker_threads');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file uploads with memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'text/csv') {
            return cb(new Error('Only CSV files are allowed'));
        }
        cb(null, true);
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

const workerPool = new WorkerPool(4);

// Handle file upload
app.post('/api/upload', upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'baseUrl', maxCount: 1 }
]), async (req, res) => {
    if (!req.files || !req.files.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const uploadedFile = req.files.file[0];
        const words = await new Promise((resolve, reject) => {
            const results = [];
            const bufferStream = require('stream').Readable.from(uploadedFile.buffer);
            bufferStream
                .pipe(parse({ 
                    delimiter: ',',
                    skip_empty_lines: true,
                    trim: true
                }))
                .on('data', (data) => {
                    results.push(...data.filter(word => word.trim()));
                })
                .on('end', () => {
                    resolve(results);
                })
                .on('error', reject);
        });

        // Create temporary directory in /tmp for Vercel
        const downloadDir = `/tmp/downloads-${Date.now()}`;
        fs.mkdirSync(downloadDir, { recursive: true });

        const baseUrl = req.body.baseUrl || '';

        const tasks = words.map(word => ({
            word,
            downloadDir,
            baseUrl
        }));

        const results = await Promise.allSettled(
            tasks.map(task => workerPool.addTask(task))
        );

        // Create zip file in /tmp
        const zipPath = `/tmp/icons-${Date.now()}.zip`;
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        await new Promise((resolve, reject) => {
            output.on('close', resolve);
            output.on('error', reject);
            archive.pipe(output);
            archive.directory(downloadDir, false);
            archive.finalize();
        });

        // Read the zip file and send it as response
        const zipContent = fs.readFileSync(zipPath);
        
        // Cleanup
        fs.rmSync(downloadDir, { recursive: true });
        fs.rmSync(zipPath);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename=icons-${Date.now()}.zip`);
        res.send(zipContent);

    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear endpoint not needed for serverless

module.exports = app;
