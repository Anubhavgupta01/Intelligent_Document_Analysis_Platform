# Intelligent Document Analysis Platform

**🏆 Sponsor Track Qualifications:**
- ✅ **Meta Sponsor Track**: Uses Meta LLaMA 3.1-8B-Instruct model
- ✅ **Docker Sponsor Track**: Features creative Docker MCP Gateway container orchestration

A full-stack AI-powered research assistant that combines document analysis, conversational AI, and intelligent insights generation using Meta's LLaMA 3.1 model.

## 🚀 Features

### 🤖 AI-Powered Chat
- **Meta LLaMA 3.1-8B-Instruct** integration via Hugging Face Transformers
- Conversational AI with persistent chat history
- Context-aware responses using RAG (Retrieval-Augmented Generation)
- Real-time "AI is typing..." indicators

### 📄 Document Processing
- **Multi-format support**: PDF, DOCX, TXT files
- **Intelligent text extraction** and chunking
- **FAISS-powered semantic search** for document querying
- **Persistent document storage** during sessions

### 🎯 Smart Insights
- **Automated summarization** of documents
- **Key points extraction** (3 bullet points)
- **Actionable tasks generation** (2 tasks per document)
- **One-click insights** from the right panel

### 🎨 Modern UI/UX
- **ChatGPT-like interface** with 3-panel layout
- **Dark/light mode** toggle
- **Responsive design** with Tailwind CSS
- **Smooth animations** and transitions
- **Keyboard shortcuts** (Enter, Shift+Enter, Ctrl+K)

### 🐳 Docker MCP Gateway (Creative Container Usage)
- **Service discovery** and health monitoring
- **Intelligent request routing** with automatic failover
- **Container performance analytics**
- **Microservice communication hub**
- **Dynamic scaling patterns**

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │  MCP Gateway    │    │    Backend      │
│  (React+Vite)   │◄──►│  (FastAPI)      │◄──►│   (FastAPI)     │
│  Port: 3000     │    │  Port: 8080     │    │  Port: 8000     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                    ┌─────────────────┐    ┌─────────────────┐
                    │  LLaMA Service  │    │  Doc Extractor  │
                    │ (HF TGI/Local)  │    │   (FastAPI)     │
                    │  Port: 8080     │    │  Port: 8001     │
                    └─────────────────┘    └─────────────────┘
```

### Microservices

1. **Frontend** - React + Tailwind CSS UI
2. **Backend** - FastAPI with Meta LLaMA integration
3. **MCP Gateway** - Docker container orchestration and routing
4. **LLaMA Service** - Meta LLaMA 3.1-8B-Instruct model serving
5. **Doc Extractor** - Document text extraction service

## 🚀 Quick Start

### Prerequisites

- **Docker & Docker Compose**
- **Hugging Face Account** (for LLaMA model access)
- **8GB+ RAM** (for LLaMA model)
- **NVIDIA GPU** (optional, for faster inference)

### 1. Clone Repository

```bash
git clone <repository-url>
cd GenAI-Research-Assistant-for-Teams
```

### 2. Set Environment Variables

Create a `.env` file:

```bash
# Required: Hugging Face token for Meta LLaMA access
HUGGINGFACE_HUB_TOKEN=your_hf_token_here

# Optional: Model configuration
MODEL_ID=meta-llama/Llama-3.1-8B-Instruct
```

**Get your Hugging Face token:**
1. Visit [https://huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Create a new token with "Read" permissions
3. Accept the Meta LLaMA 3.1 model license at [https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct](https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct)

### 3. Deploy with Docker

```bash
# Build and start all services
docker compose up --build

# Or run in background
docker compose up --build -d
```

### 4. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **MCP Gateway**: http://localhost:8080
- **Doc Extractor**: http://localhost:8001

## 🛠️ Development Setup

### Local Development (Without Docker)

#### Backend Setup

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt

# Set environment variables
set HUGGINGFACE_HUB_TOKEN=your_token
set MODEL_ID=meta-llama/Llama-3.1-8B-Instruct

# Start backend
uvicorn app.main:app --reload --port 8000
```

#### Frontend Setup

```bash
cd frontend
npm install

# Set API URL
set VITE_API_URL=http://localhost:8000

# Start frontend
npm run dev
```

## 📡 API Endpoints

### Backend (Port 8000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/upload` | POST | Upload and process documents |
| `/chat` | POST | Chat with Meta LLaMA |
| `/summarize` | POST | Generate document summary + insights |
| `/qa` | POST | Question answering with RAG |

### MCP Gateway (Port 8080)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Gateway info and creative patterns |
| `/health` | GET | Gateway and services health |
| `/services` | GET | Service registry status |
| `/metrics` | GET | Container metrics and analytics |
| `/proxy/{service}/{path}` | ANY | Service proxy with health-aware routing |

## 🎯 Usage Examples

### 1. Document Upload & Analysis

```bash
# Upload a PDF document
curl -X POST "http://localhost:8000/upload" \
  -F "file=@research_paper.pdf"

# Response: {"document_id": "uuid", "characters": 15420}
```

### 2. Chat with Meta LLaMA

```bash
# Send a chat message
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain quantum computing",
    "history": []
  }'
```

### 3. Generate Insights

```bash
# Get document summary with key points and tasks
curl -X POST "http://localhost:8000/summarize" \
  -H "Content-Type: application/json" \
  -d '{"document_id": "your-doc-id"}'

# Response:
# {
#   "summary": "Document summary...",
#   "key_points": ["Point 1", "Point 2", "Point 3"],
#   "tasks": ["Task 1", "Task 2"]
# }
```

### 4. MCP Gateway Service Discovery

```bash
# Check service health through gateway
curl "http://localhost:8080/health"

# Get container metrics
curl "http://localhost:8080/metrics"

# Proxy request to backend through gateway
curl "http://localhost:8080/proxy/backend/health"
```

## 🏆 Sponsor Track Compliance

### Meta Sponsor Track ✅

- **Model**: Meta LLaMA 3.1-8B-Instruct
- **Integration**: Hugging Face Transformers
- **Usage**: Chat endpoint, summarization, Q&A
- **Authentication**: HUGGINGFACE_HUB_TOKEN environment variable
- **Format**: Proper LLaMA 3.1 Instruct formatting with system/user/assistant tags

### Docker Sponsor Track ✅

- **Creative Container Usage**: MCP Gateway service orchestration
- **Microservices**: 5 containerized services with inter-service communication
- **Service Discovery**: Dynamic health monitoring and routing
- **Container Analytics**: Performance metrics and resource utilization
- **Orchestration**: Docker Compose with custom networking and volumes

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUGGINGFACE_HUB_TOKEN` | HF token for model access | Required |
| `MODEL_ID` | LLaMA model identifier | `meta-llama/Llama-3.1-8B-Instruct` |
| `VITE_API_URL` | Frontend API URL | `http://localhost:8000` |

### Docker Configuration

- **Networks**: Custom `mcp` network for service communication
- **Volumes**: `hf-cache` for model caching
- **Health Checks**: Automatic service health monitoring
- **Resource Limits**: Optimized for LLaMA model requirements

## 🚨 Troubleshooting

### Common Issues

1. **"Model not found" errors**
   - Ensure HUGGINGFACE_HUB_TOKEN is set
   - Accept LLaMA 3.1 license on Hugging Face
   - Check internet connectivity for model download

2. **Out of memory errors**
   - Increase Docker memory limit (8GB+)
   - Use smaller model variant if needed
   - Enable GPU acceleration if available

3. **Service connection errors**
   - Check all containers are running: `docker compose ps`
   - Verify network connectivity: `docker network ls`
   - Check logs: `docker compose logs [service-name]`

### Performance Optimization

- **GPU Usage**: Install NVIDIA Container Toolkit for GPU acceleration
- **Model Caching**: Models are cached in `hf-cache` volume
- **Memory Management**: Adjust container memory limits in docker-compose.yml

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Meta** for the LLaMA 3.1 model
- **Hugging Face** for model hosting and transformers library
- **Docker** for containerization platform
- **FastAPI** for high-performance API framework
- **React** for modern frontend framework
