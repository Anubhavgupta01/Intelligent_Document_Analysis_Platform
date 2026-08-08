import os
import threading
from typing import Optional, List, Iterator
import logging

try:
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    logging.warning("Transformers not available, falling back to mock responses")

_model_lock = threading.Lock()
_model_cache = {}

logger = logging.getLogger(__name__)


def get_model_id() -> str:
    return os.getenv("MODEL_ID", "meta-llama/Llama-3.1-8B-Instruct")


def get_huggingface_token() -> Optional[str]:
    return os.getenv("HUGGINGFACE_HUB_TOKEN")


class MockTokenizer:
    """Mock tokenizer for compatibility with pipeline attributes"""
    def __init__(self):
        self.eos_token_id = 0

class HFInferenceAPI:
    """Uses Hugging Face Serverless Inference API for generation"""

    def __init__(self, model_id: str, token: str):
        self.model_id = model_id
        self.token = token

        from huggingface_hub import InferenceClient

        self.client = InferenceClient(
            model=model_id,
            token=token
        )

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
                import traceback

                traceback.print_exc()
                logger.exception("HF Inference API failed")

                raise  

        return results

def get_text_generation_pipeline():
    """Get or create the text generation pipeline with Meta LLaMA"""
    model_id = get_model_id()
    hf_token = get_huggingface_token()
    
    # Prefer Hugging Face Serverless Inference API if token is provided
    use_api = os.getenv("USE_HF_INFERENCE_API", "true").lower() == "true"
    if use_api and hf_token:
        with _model_lock:
            if model_id not in _model_cache:
                try:
                    logger.info(f"Using Hugging Face Serverless Inference API for model: {model_id}")
                    _model_cache[model_id] = HFInferenceAPI(model_id, hf_token)
                except Exception as e:
                    import traceback
                    traceback.print_exc()
                    logger.exception("HF Inference API initialization failed")
                    raise
            if model_id in _model_cache:
                return _model_cache[model_id]
    
    if not TRANSFORMERS_AVAILABLE:
        logger.warning("Transformers not available, using mock responses")
        return MockTextGeneration()
    
    with _model_lock:
        if model_id not in _model_cache:
            try:
                logger.info(f"Loading model locally: {model_id}")
                
                # Load tokenizer and model
                tokenizer = AutoTokenizer.from_pretrained(
                    model_id, 
                    token=hf_token,
                    trust_remote_code=True
                )
                
                model = AutoModelForCausalLM.from_pretrained(
                    model_id,
                    token=hf_token,
                    torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                    device_map="auto" if torch.cuda.is_available() else None,
                    trust_remote_code=True,
                    low_cpu_mem_usage=True
                )
                
                # Create pipeline
                pipe = pipeline(
                    "text-generation",
                    model=model,
                    tokenizer=tokenizer,
                    max_new_tokens=512,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=tokenizer.eos_token_id
                )
                
                _model_cache[model_id] = pipe
                logger.info(f"Successfully loaded model locally: {model_id}")
                
            except Exception as e:
                import traceback

                traceback.print_exc()
                logger.exception(f"Failed to load model locally: {model_id}")

                raise 
        
        return _model_cache[model_id]



class MockTextGeneration:
    """Mock text generation for fallback when models aren't available"""
    
    def __call__(self, prompts, **kwargs):
        if isinstance(prompts, str):
            prompts = [prompts]
        return [{"generated_text": self._mock_response(p)} for p in prompts]
    
    def _mock_response(self, prompt: str) -> str:
        responses = [
            "This is a mock response for testing purposes. Please configure HUGGINGFACE_HUB_TOKEN to use Meta LLaMA.",
            "Demo mode: The system would normally use Meta LLaMA 3.1-8B-Instruct for this response.",
            "Mock AI response: Configure the environment variables to enable Meta LLaMA integration.",
            "Fallback response: The request has been processed successfully in demo mode.",
        ]
        import random
        return random.choice(responses)


def format_llama_prompt(system_prompt: str, user_prompt: str) -> str:
    """Format prompt for Meta LLaMA 3.1 Instruct"""
    return f"<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n\n{system_prompt}<|eot_id|><|start_header_id|>user<|end_header_id|>\n\n{user_prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n"


def generate_batch_with_system_prompt(system_prompt: str, user_prompts: List[str]) -> List[str]:
    pipe = get_text_generation_pipeline()
    
    if isinstance(pipe, MockTextGeneration):
        # Mock responses
        prompts = [f"{system_prompt}\n{u}" for u in user_prompts]
        outputs = pipe(prompts)
        results = []
        for out in outputs:
            text = out["generated_text"] if isinstance(out, dict) else out[0]["generated_text"]
            results.append(text.strip())
        return results
    
    # Real LLaMA model
    results = []
    for user_prompt in user_prompts:
        formatted_prompt = format_llama_prompt(system_prompt, user_prompt)
        
        try:
            outputs = pipe(
                formatted_prompt,
                max_new_tokens=512,
                temperature=0.7,
                do_sample=True,
                return_full_text=False,
                pad_token_id=pipe.tokenizer.eos_token_id
            )
            
            if outputs and len(outputs) > 0:
                generated_text = outputs[0]["generated_text"].strip()
                # Clean up any remaining special tokens
                generated_text = generated_text.replace("<|eot_id|>", "").strip()
                results.append(generated_text)
            else:
                results.append("I apologize, but I couldn't generate a response.")
                
        except Exception as e:
            import traceback

            traceback.print_exc()
            logger.exception("Generation failed")

            raise
    return results


def generate_with_system_prompt(system_prompt: str, user_prompt: str) -> str:
    return generate_batch_with_system_prompt(system_prompt, [user_prompt])[0]


def generate_chat_response(messages: List[dict], max_new_tokens: int = 512) -> str:
    """Generate chat response using conversation history"""
    pipe = get_text_generation_pipeline()
    
    if isinstance(pipe, MockTextGeneration):
        return pipe._mock_response("Chat conversation")
    
    # Format conversation for LLaMA
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
    
    # Add assistant turn
    conversation += "<|start_header_id|>assistant<|end_header_id|>\n\n"
    
    try:
        outputs = pipe(
            conversation,
            max_new_tokens=max_new_tokens,
            temperature=0.7,
            do_sample=True,
            return_full_text=False,
            pad_token_id=pipe.tokenizer.eos_token_id
        )
        
        if outputs and len(outputs) > 0:
            generated_text = outputs[0]["generated_text"].strip()
            # Clean up any remaining special tokens
            generated_text = generated_text.replace("<|eot_id|>", "").strip()
            return generated_text
        else:
            return "I apologize, but I couldn't generate a response."
            
    except Exception as e:
        logger.error(f"Error generating chat response: {e}")
        return "I apologize, but there was an error generating the response."

