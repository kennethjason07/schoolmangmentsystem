# Teacher Chat Badge Integration Test Plan

## Overview
Testing the integration between TeacherChat local unread counts and UniversalNotificationBadge system to ensure the chat tab badge updates accurately when messages are received and read.

## Components Updated
1. **TeacherChat.js** - Added `broadcastMessageRead()` call when marking messages as read
2. **UniversalNotificationService.js** - Already has `broadcastMessageRead()` method implemented

## Test Scenarios

### Scenario 1: Parent sends message to teacher
**Expected Behavior:**
1. Parent sends a message to teacher
2. Teacher's chat tab badge count should increase by 1
3. UniversalNotificationBadge should reflect the new unread message count
4. Local unreadCounts state in TeacherChat should also update

**Key Code Flow:**
- Parent sends message → Database INSERT → Real-time subscription in TeacherChat triggers
- `setUnreadCounts()` updates local state for badge display
- UniversalNotificationService detects new message and updates badge count

### Scenario 2: Teacher reads messages from parent
**Expected Behavior:**
1. Teacher selects parent contact and views messages
2. Messages get marked as read via `markMessagesAsRead()`
3. `broadcastMessageRead()` is called to notify UniversalNotificationService
4. Chat tab badge count decreases by the number of read messages
5. Local unreadCounts state removes the parent's unread count

**Key Code Flow:**
- `fetchMessages()` → `markMessagesAsRead()` → `broadcastMessageRead()`
- Real-time subscription in UniversalNotificationBadge receives broadcast
- Badge count updates immediately

### Scenario 3: Student sends message to teacher  
**Expected Behavior:**
1. Student sends a message to teacher
2. Teacher's chat tab badge count should increase by 1
3. Both local chat screen badge and bottom navigation badge should update

## Technical Integration Points

### 1. Real-time Subscriptions
- **TeacherChat**: Subscribes to message INSERTs/UPDATEs for badge updates
- **UniversalNotificationBadge**: Subscribes to message changes and broadcast events

### 2. Broadcasting System
- When messages are marked as read in TeacherChat:
  ```js
  universalNotificationService.broadcastMessageRead(user.id, contactUserId);
  ```
- UniversalNotificationService broadcasts to all subscribers:
  ```js
  channel.send({
    type: 'broadcast',
    event: 'message-read',
    payload: { user_id: userId, sender_id: senderId, timestamp: ... }
  });
  ```

### 3. Cache Management
- UniversalNotificationService clears cache when messages are read
- Forces fresh count fetch on next badge render

## Verification Steps

### Manual Testing
1. **Setup**: Have teacher and parent accounts ready
2. **Test 1**: Send message from parent to teacher
   - Check if teacher's chat tab badge increases
   - Verify count accuracy
3. **Test 2**: Teacher reads the message
   - Check if badge count decreases to 0
   - Verify timing (should be near-instant)

### Debug Logging
Key log messages to look for:
- `📨 TeacherChat Badge: New message received from:`
- `✅ TeacherChat: Messages marked as read, broadcasting to universal service`
- `💬 [UniversalNotificationService] Message read broadcast:`
- `📊 TeacherChat Badge: Updated counts after read:`

## Expected Issues and Solutions

### Issue 1: Timing delays
**Problem**: Badge update may be delayed
**Solution**: Broadcasting system provides instant updates

### Issue 2: Count mismatches
**Problem**: Local counts vs universal counts differ
**Solution**: Both systems query same database and use same logic

### Issue 3: Multiple subscriptions
**Problem**: Memory leaks from subscriptions
**Solution**: Proper cleanup in useEffect and component unmount

## Success Criteria
- ✅ Badge count increases immediately when messages received
- ✅ Badge count decreases immediately when messages read  
- ✅ Counts are accurate and consistent between local and universal systems
- ✅ No memory leaks from subscriptions
- ✅ Works for both parent and student messaging

## Next Steps
If tests pass successfully:
1. Verify with multiple teacher accounts
2. Test with high message volume
3. Test edge cases (offline/online scenarios)
4. Performance testing with many concurrent users
