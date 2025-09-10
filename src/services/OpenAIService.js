import axios from 'axios';

// OpenAI Service for ChatGPT integration
class OpenAIService {
  constructor() {
    // You'll need to set your OpenAI API key in your environment variables
    // For now, we'll use a placeholder - replace this with your actual API key
    this.apiKey = process.env.REACT_APP_OPENAI_API_KEY || 'your-openai-api-key-here';
    this.baseURL = 'https://api.openai.com/v1';
    this.model = 'gpt-3.5-turbo'; // You can also use 'gpt-4' if you have access
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      timeout: 30000 // 30 second timeout
    });
  }

  // Check if API key is configured
  isConfigured() {
    return this.apiKey && this.apiKey !== 'your-openai-api-key-here';
  }

  // Generate AI response using ChatGPT
  async generateResponse(userMessage, conversationHistory = []) {
    try {
      if (!this.isConfigured()) {
        throw new Error('OpenAI API key is not configured. Please set REACT_APP_OPENAI_API_KEY in your environment variables.');
      }

      // Prepare the conversation with system message for educational context
      const messages = [
        {
          role: 'system',
          content: `You are EduCartoon, an AI assistant for a school management system. You help students, teachers, and parents with educational questions, school-related queries, and provide helpful information about academics, assignments, and school life. Be friendly, educational, and supportive. Keep your responses concise and helpful.`
        },
        ...conversationHistory,
        {
          role: 'user',
          content: userMessage
        }
      ];

      const response = await this.axiosInstance.post('/chat/completions', {
        model: this.model,
        messages: messages,
        max_tokens: 500, // Limit response length
        temperature: 0.7, // Control creativity (0-1)
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      if (response.data && response.data.choices && response.data.choices.length > 0) {
        return {
          success: true,
          message: response.data.choices[0].message.content,
          usage: response.data.usage
        };
      } else {
        throw new Error('No response received from OpenAI');
      }

    } catch (error) {
      console.error('OpenAI API Error:', error);
      
      // Handle different types of errors
      if (error.response?.status === 401) {
        return {
          success: false,
          error: 'Invalid API key. Please check your OpenAI API configuration.',
          fallback: true
        };
      } else if (error.response?.status === 429) {
        return {
          success: false,
          error: 'Too many requests. Please wait a moment and try again.',
          fallback: true
        };
      } else if (error.response?.status === 500) {
        return {
          success: false,
          error: 'OpenAI service is currently unavailable. Please try again later.',
          fallback: true
        };
      } else {
        return {
          success: false,
          error: error.message || 'Failed to get AI response',
          fallback: true
        };
      }
    }
  }

  // Get a fallback response when API is not available
  getFallbackResponse(userMessage) {
    const fallbackResponses = [
      "I'm here to help! As EduCartoon, I can assist with educational questions, homework help, and school-related queries. However, I'm currently offline. Please try again later or contact your teacher for assistance.",
      
      "Hello! I'm EduCartoon, your educational AI assistant. I'm currently experiencing technical difficulties. In the meantime, you can:",
      "• Ask your teacher or classmates for help\n• Check your textbooks and study materials\n• Use the school's online resources\n• Try again in a few minutes",
      
      "Hi there! EduCartoon here. I'm temporarily unavailable, but I'd love to help you with:\n• Homework questions\n• Study tips\n• School project ideas\n• Learning concepts\n\nPlease try again shortly!",
      
      "EduCartoon is currently offline for maintenance. Don't worry - learning never stops! Try:\n• Reviewing your class notes\n• Discussing with study groups\n• Using educational websites\n• Coming back later to chat with me!"
    ];

    // Simple keyword-based fallback responses
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('homework') || lowerMessage.includes('assignment')) {
      return "I'd love to help with your homework! Unfortunately, I'm currently offline. Try breaking down your assignment into smaller parts, use your textbooks, and don't hesitate to ask your teacher for guidance.";
    }
    
    if (lowerMessage.includes('math') || lowerMessage.includes('mathematics')) {
      return "Math can be challenging but fun! While I'm offline, try practicing with your textbook examples, use online math tools, or form a study group with classmates.";
    }
    
    if (lowerMessage.includes('science') || lowerMessage.includes('physics') || lowerMessage.includes('chemistry') || lowerMessage.includes('biology')) {
      return "Science is amazing! While I'm temporarily unavailable, try conducting simple experiments, watching educational videos, or reviewing your science textbook.";
    }
    
    if (lowerMessage.includes('english') || lowerMessage.includes('literature') || lowerMessage.includes('writing')) {
      return "Language and literature are wonderful subjects! While I'm offline, try reading more, keeping a journal, or discussing books with friends and family.";
    }

    // Random fallback for general queries
    return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
  }

  // Generate response with fallback
  async generateResponseWithFallback(userMessage, conversationHistory = []) {
    try {
      const response = await this.generateResponse(userMessage, conversationHistory);
      
      if (response.success) {
        return response;
      } else if (response.fallback) {
        return {
          success: true,
          message: this.getFallbackResponse(userMessage),
          isFallback: true,
          originalError: response.error
        };
      }
      
      return response;
    } catch (error) {
      return {
        success: true,
        message: this.getFallbackResponse(userMessage),
        isFallback: true,
        originalError: error.message
      };
    }
  }

  // Test the API connection
  async testConnection() {
    try {
      const response = await this.generateResponse("Hello, are you working?");
      return {
        success: response.success,
        message: response.success ? 'OpenAI API connection successful!' : response.error
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
  }
}

// Export a singleton instance
const openAIService = new OpenAIService();
export default openAIService;
