import os
import threading
from typing import Optional, List
import logging
import traceback

_model_lock = threading.Lock()
_model_cache = {}

logger = logging.getLogger(__name__)


def get_model_id() -> str:
    return os.getenv("MODEL_ID", "meta-llama/Llama-3.1-8B-Instruct")


def get_huggingface_token() -> Optional[str]:
    return os.getenv("HUGGINGFACE_HUB_TOKEN")


def is_valid_hf_token(token: Optional[str]) -> bool:
    if not token:
        return False
    t = token.strip()
    if not t or t.startswith("your_") or t == "your_hf_token_here" or not t.startswith("hf_"):
        return False
    return True


def mask_token(token: Optional[str]) -> str:
    if not token or not is_valid_hf_token(token):
        return "(NOT CONFIGURED / PLACEHOLDER)"
    t = token.strip()
    return f"{t[:4]}...{t[-4:]} (LOADED)"


def log_ai_configuration():
    token = get_huggingface_token()
    model_id = get_model_id()
    logger.info(f"=== AI Service Configuration ===")
    logger.info(f"Model ID: {model_id}")
    logger.info(f"Hugging Face Token: {mask_token(token)}")
    if not is_valid_hf_token(token):
        logger.warning("WARNING: No valid HUGGINGFACE_HUB_TOKEN found in environment (must start with 'hf_'). API requests will require a valid token.")


class MockTokenizer:
    """Mock tokenizer for compatibility with pipeline attributes"""
    def __init__(self):
        self.eos_token_id = 0


class HFInferenceAPI:
    """Uses Hugging Face Serverless Inference API for generation"""

    def __init__(self, model_id: str, token: str):
        self.model_id = model_id
        self.token = token

        try:
            from huggingface_hub import InferenceClient
            self.client = InferenceClient(
                model=model_id,
                token=token
            )
        except ImportError:
            logger.error("huggingface_hub library is not installed in the python environment.")
            raise RuntimeError("huggingface_hub library is not installed in backend environment.")

        self.tokenizer = MockTokenizer()

    def __call__(self, prompts, **kwargs):
        if isinstance(prompts, str):
            prompts = [prompts]

        clean_kwargs = {}
        for key in ["max_new_tokens", "temperature", "do_sample", "return_full_text"]:
            if key in kwargs:
                clean_kwargs[key] = kwargs[key]

        results = []

        for prompt in prompts:
            try:
                response = self.client.chat.completions.create(
                    model=self.model_id,
                    messages=[
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    max_tokens=clean_kwargs.get("max_new_tokens", 512),
                    temperature=clean_kwargs.get("temperature", 0.7),
                )

                text = response.choices[0].message.content

                results.append({
                    "generated_text": text
                })

            except Exception as e:
                traceback.print_exc()
                logger.exception(f"HF Inference API call failed for model '{self.model_id}': {e}")
                raise

        return results


def get_text_generation_pipeline():
    """Get or create the text generation pipeline with Meta LLaMA via Hugging Face API"""
    model_id = get_model_id()
    hf_token = get_huggingface_token()
    
    if not is_valid_hf_token(hf_token):
        logger.error(f"Cannot initialize AI model: HUGGINGFACE_HUB_TOKEN is not configured or invalid (token value: '{hf_token}').")
        raise RuntimeError("Hugging Face API token (HUGGINGFACE_HUB_TOKEN) is not configured in backend/.env. Please set a valid token starting with 'hf_'.")

    with _model_lock:
        if model_id not in _model_cache:
            try:
                logger.info(f"Initializing Hugging Face Serverless Inference API for model: {model_id}")
                _model_cache[model_id] = HFInferenceAPI(model_id, hf_token)
            except Exception as e:
                traceback.print_exc()
                logger.exception(f"HF Inference API initialization failed for model '{model_id}': {e}")
                raise
        return _model_cache[model_id]


def format_llama_prompt(system_prompt: str, user_prompt: str) -> str:
    """Format prompt for Meta LLaMA 3.1 Instruct"""
    return f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{user_prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"


def generate_batch_with_system_prompt(system_prompt: str, user_prompts: List[str]) -> List[str]:
    pipe = get_text_generation_pipeline()
    
    results = []
    for user_prompt in user_prompts:
        formatted_prompt = format_llama_prompt(system_prompt, user_prompt)
        
        try:
            outputs = pipe(
                formatted_prompt,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                return_full_text=False
            )
            
            if outputs and len(outputs) > 0:
                generated_text = outputs[0]["generated_text"].strip()
                generated_text = generated_text.replace("<|eot_id|>", "").strip()
                results.append(generated_text)
            else:
                raise RuntimeError("AI model returned an empty response.")
                
        except Exception as e:
            traceback.print_exc()
            logger.exception(f"Generation failed for user prompt: {e}")
            raise

    return results


def generate_with_system_prompt(system_prompt: str, user_prompt: str) -> str:
    return generate_batch_with_system_prompt(system_prompt, [user_prompt])[0]


def generate_chat_response(messages: List[dict], max_new_tokens: int = 512) -> str:
    """Generate chat response using conversation history"""
    pipe = get_text_generation_pipeline()
    
    conversation = "<|begin_of_text|>"
    for message in messages:
        role = message["role"]
        content = message["content"]
        
        if role == "system":
            conversation += f"<|start_header_id|>system<|end_header_id|>\n\n{content}<|eot_id|>"
        elif role == "user":
            conversation += f"<|start_header_id|>user<|end_header_id|>\n\n{content}<|eot_id|>"
        elif role == "assistant":
            conversation += f"<|start_header_id|>assistant<|end_header_id|>\n\n{content}<|eot_id|>"
    
    conversation += "<|start_header_id|>assistant<|end_header_id|>\n\n"
    
    try:
        outputs = pipe(
            conversation,
            max_new_tokens=max_new_tokens,
            temperature=0.7,
            do_sample=True,
            return_full_text=False
        )
        
        if outputs and len(outputs) > 0:
            generated_text = outputs[0]["generated_text"].strip()
            generated_text = generated_text.replace("<|eot_id|>", "").strip()
            return generated_text
        else:
            raise RuntimeError("AI model returned an empty chat response.")
            
    except Exception as e:
        traceback.print_exc()
        logger.exception(f"Chat generation failed: {e}")
        raise


