import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform, 
  ActivityIndicator, 
  Alert,
  Keyboard,
  Animated,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';
import Header from '../../components/Header';
import openAIService from '../../services/OpenAIService';
import { formatToLocalTime } from '../../utils/timeUtils';

const { width, height } = Dimensions.get('window');

const EduCartoonAI = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('unknown');
  
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  // Welcome message
  useEffect(() => {
    // Add welcome message
    const welcomeMessage = {
      id: 'welcome_' + Date.now(),
      message: "Hello! I'm EduCartoon 🎓, your AI learning companion! I'm here to help you with:\n\n• Homework and assignments\n• Study tips and techniques\n• Subject explanations\n• School project ideas\n• Learning concepts\n• Educational questions\n\nWhat would you like to learn about today?",
      isAI: true,
      timestamp: new Date().toISOString(),
      isWelcome: true
    };
    
    setMessages([welcomeMessage]);

    // Animate welcome message
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();

    // Test connection on startup
    testConnection();
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  // Test OpenAI connection
  const testConnection = async () => {
    try {
      setConnectionStatus('testing');
      const result = await openAIService.testConnection();
      setConnectionStatus(result.success ? 'connected' : 'offline');
    } catch (error) {
      setConnectionStatus('offline');
    }
  };

  // Handle sending message
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const messageId = Date.now().toString();
    
    // Add user message
    const newUserMessage = {
      id: messageId,
      message: userMessage,
      isAI: false,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setLoading(true);
    setShowWelcome(false);

    // Scroll to bottom
    setTimeout(() => {
      if (flatListRef.current) {
        flatListRef.current.scrollToEnd({ animated: true });
      }
    }, 100);

    try {
      // Prepare conversation history for context (last 5 exchanges)
      const conversationHistory = messages
        .slice(-10) // Last 10 messages
        .filter(msg => !msg.isWelcome) // Exclude welcome message
        .map(msg => ({
          role: msg.isAI ? 'assistant' : 'user',
          content: msg.message
        }));

      // Get AI response
      const response = await openAIService.generateResponseWithFallback(
        userMessage, 
        conversationHistory
      );

      if (response.success) {
        const aiMessage = {
          id: 'ai_' + Date.now(),
          message: response.message,
          isAI: true,
          timestamp: new Date().toISOString(),
          isFallback: response.isFallback || false,
          usage: response.usage
        };

        setMessages(prev => [...prev, aiMessage]);

        // Update connection status based on response
        if (!response.isFallback) {
          setConnectionStatus('connected');
        }
      } else {
        // Show error message
        const errorMessage = {
          id: 'error_' + Date.now(),
          message: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment, or contact your teacher for assistance.",
          isAI: true,
          timestamp: new Date().toISOString(),
          isError: true
        };

        setMessages(prev => [...prev, errorMessage]);
        setConnectionStatus('offline');
      }

    } catch (error) {
      console.error('Chat error:', error);
      
      const errorMessage = {
        id: 'error_' + Date.now(),
        message: "Oops! Something went wrong. Please try again or contact your teacher for help.",
        isAI: true,
        timestamp: new Date().toISOString(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
      setConnectionStatus('offline');
    } finally {
      setLoading(false);
      
      // Scroll to bottom after response
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 200);
    }
  };

  // Quick suggestion buttons
  const quickSuggestions = [
    "Help me with math homework",
    "Explain photosynthesis",
    "Tips for better writing",
    "How to study effectively",
    "Science project ideas",
    "Grammar rules"
  ];

  const handleQuickSuggestion = (suggestion) => {
    setInput(suggestion);
    setShowWelcome(false);
  };

  // Clear conversation
  const clearConversation = () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear all messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: () => {
            setMessages([]);
            setShowWelcome(true);
            setConnectionStatus('unknown');
            // Re-add welcome message
            setTimeout(() => {
              const welcomeMessage = {
                id: 'welcome_' + Date.now(),
                message: "Hello! I'm EduCartoon 🎓, your AI learning companion! What would you like to learn about today?",
                isAI: true,
                timestamp: new Date().toISOString(),
                isWelcome: true
              };
              setMessages([welcomeMessage]);
            }, 500);
          }
        }
      ]
    );
  };

  // Connection status indicator
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#4CAF50';
      case 'offline': return '#f44336';
      case 'testing': return '#FF9800';
      default: return '#9E9E9E';
    }
  };

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'AI Online';
      case 'offline': return 'Offline Mode';
      case 'testing': return 'Connecting...';
      default: return 'Unknown';
    }
  };

  // Render message item
  const renderMessage = ({ item, index }) => {
    const isUser = !item.isAI;
    
    return (
      <Animatable.View
        animation={index === messages.length - 1 ? "fadeInUp" : undefined}
        duration={300}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.aiMessageContainer
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Ionicons name="school" size={16} color="#fff" />
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
          item.isError && styles.errorBubble,
          item.isFallback && styles.fallbackBubble
        ]}>
          <Text style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.aiMessageText,
            item.isError && styles.errorMessageText
          ]}>
            {item.message}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isUser ? styles.userMessageTime : styles.aiMessageTime
            ]}>
              {formatToLocalTime(item.timestamp)}
            </Text>
            
            {item.isFallback && (
              <View style={styles.offlineIndicator}>
                <Ionicons name="wifi-outline" size={10} color="#666" />
                <Text style={styles.offlineText}>Offline</Text>
              </View>
            )}
          </View>
        </View>
        
        {isUser && (
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={16} color="#fff" />
          </View>
        )}
      </Animatable.View>
    );
  };

  return (
    <View style={styles.container}>
      <Header 
        title="EduCartoon AI" 
        showBack={true}
        rightComponent={
          <View style={styles.headerRight}>
            <View style={[styles.statusIndicator, { backgroundColor: getConnectionStatusColor() }]}>
              <Text style={styles.statusText}>{getConnectionStatusText()}</Text>
            </View>
            <TouchableOpacity onPress={clearConversation} style={styles.headerButton}>
              <Ionicons name="refresh" size={20} color="#1976d2" />
            </TouchableOpacity>
          </View>
        }
      />

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
      >
        {messages.length === 0 ? (
          <Animated.View style={[
            styles.emptyContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}>
            <Animatable.View animation="bounce" iterationCount="infinite" direction="alternate">
              <View style={styles.logoContainer}>
                <Ionicons name="school" size={60} color="#1976d2" />
              </View>
            </Animatable.View>
            <Text style={styles.emptyTitle}>Welcome to EduCartoon AI! 🎓</Text>
            <Text style={styles.emptySubtitle}>Your personal learning assistant</Text>
          </Animated.View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (flatListRef.current && messages.length > 0) {
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              }
            }}
          />
        )}

        {showWelcome && (
          <Animatable.View animation="fadeInUp" style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>Quick Questions:</Text>
            <View style={styles.suggestionsGrid}>
              {quickSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleQuickSuggestion(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animatable.View>
        )}

        {loading && (
          <Animatable.View animation="fadeIn" style={styles.loadingContainer}>
            <View style={styles.typingIndicator}>
              <ActivityIndicator size="small" color="#1976d2" />
              <Text style={styles.typingText}>EduCartoon is thinking...</Text>
            </View>
          </Animatable.View>
        )}

        <View style={[
          styles.inputContainer,
          { paddingBottom: Platform.OS === 'ios' ? (isKeyboardVisible ? 20 : 10) : 10 }
        ]}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask me anything about learning..."
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline={true}
            maxLength={500}
            editable={!loading}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || loading}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={(!input.trim() || loading) ? "#ccc" : "#fff"} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  
  chatContainer: {
    flex: 1,
  },
  
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  
  headerButton: {
    padding: 8,
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  
  messagesList: {
    flex: 1,
  },
  
  messagesContent: {
    padding: 16,
    flexGrow: 1,
  },
  
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  
  userMessageContainer: {
    justifyContent: 'flex-end',
  },
  
  aiMessageContainer: {
    justifyContent: 'flex-start',
  },
  
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  
  userBubble: {
    backgroundColor: '#1976d2',
    borderBottomRightRadius: 4,
  },
  
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  
  errorBubble: {
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 1,
  },
  
  fallbackBubble: {
    backgroundColor: '#fff3e0',
    borderColor: '#FF9800',
    borderWidth: 1,
  },
  
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  
  userMessageText: {
    color: '#fff',
  },
  
  aiMessageText: {
    color: '#333',
  },
  
  errorMessageText: {
    color: '#d32f2f',
  },
  
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  
  messageTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  
  userMessageTime: {
    color: '#fff',
  },
  
  aiMessageTime: {
    color: '#666',
  },
  
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  offlineText: {
    fontSize: 10,
    color: '#666',
    marginLeft: 2,
  },
  
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 12,
  },
  
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  
  suggestionButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  
  suggestionText: {
    color: '#1976d2',
    fontSize: 13,
    fontWeight: '500',
  },
  
  loadingContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  
  typingText: {
    color: '#666',
    fontSize: 14,
    marginLeft: 8,
    fontStyle: 'italic',
  },
  
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  
  textInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    marginRight: 8,
    textAlignVertical: 'top',
  },
  
  sendButton: {
    backgroundColor: '#1976d2',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
});

export default EduCartoonAI;
