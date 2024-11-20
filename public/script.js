document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const resultSection = document.getElementById('resultSection');
    const downloadLink = document.getElementById('downloadLink');
    const errorSection = document.getElementById('errorSection');
    const errorList = document.getElementById('errorList');
    const stats = document.getElementById('stats');
    const clearButton = document.getElementById('clearAll');
    const baseUrlInput = document.getElementById('baseUrl');

    // Handle drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight() {
        dropZone.classList.add('dragover');
    }

    function unhighlight() {
        dropZone.classList.remove('dragover');
    }

    // Handle file drop
    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        if (file.type !== 'text/csv') {
            showError('Please upload a CSV file');
            return;
        }

        fileInfo.textContent = `Selected file: ${file.name}`;
        uploadFile(file);
    }

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add baseUrl to the form data if provided
        const baseUrl = baseUrlInput.value.trim();
        if (baseUrl) {
            formData.append('baseUrl', baseUrl);
        }

        showProgress();
        clearErrors();

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                showResult(data);
            } else {
                showError(data.error);
            }
        } catch (error) {
            showError('Upload failed: ' + error.message);
        }
    }

    function showProgress() {
        progressSection.style.display = 'block';
        resultSection.style.display = 'none';
        errorSection.style.display = 'none';
        progressBar.style.width = '0%';
        
        // Simulate progress
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) {
                clearInterval(interval);
                return;
            }
            progressBar.style.width = `${Math.min(progress, 90)}%`;
        }, 500);
    }

    function showResult(data) {
        progressBar.style.width = '100%';
        progressSection.style.display = 'none';
        resultSection.style.display = 'block';
        
        downloadLink.href = data.downloadUrl;
        
        // Display statistics
        stats.innerHTML = `
            <p>Total words processed: ${data.processedWords}</p>
            ${data.errors.length ? `<p>Errors encountered: ${data.errors.length}</p>` : ''}
        `;

        if (data.errors.length > 0) {
            showErrors(data.errors);
        }
    }

    function showError(message) {
        errorSection.style.display = 'block';
        progressSection.style.display = 'none';
        errorList.innerHTML = `<li>${message}</li>`;
    }

    function showErrors(errors) {
        errorSection.style.display = 'block';
        errorList.innerHTML = errors.map(error => `<li>${error}</li>`).join('');
    }

    function clearErrors() {
        errorSection.style.display = 'none';
        errorList.innerHTML = '';
    }

    // Handle clear all button
    clearButton.addEventListener('click', async () => {
        try {
            const response = await fetch('/clear', {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                // Reset UI
                fileInfo.textContent = '';
                progressSection.style.display = 'none';
                resultSection.style.display = 'none';
                errorSection.style.display = 'none';
                progressBar.style.width = '0%';
                fileInput.value = '';
            } else {
                showError(data.error);
            }
        } catch (error) {
            showError('Clear failed: ' + error.message);
        }
    });
});
