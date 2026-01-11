import { useState, useEffect, useRef } from 'react';
import { Users, MessageCircle, AtSign, X, Send } from 'lucide-react';

/**
 * Real-time collaboration indicator showing who's viewing the file
 */
export default function CollaborationIndicator({ 
  fileId, 
  fileName,
  ws, 
  currentUser,
  onMention 
}) {
  const [viewers, setViewers] = useState([]);
  const [cursors, setCursors] = useState({});
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [myColor, setMyColor] = useState('#1a73e8');
  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (!ws || !fileId) return;

    // Join file
    ws.send(JSON.stringify({
      type: 'join_file',
      fileId
    }));

    // Handle messages
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'joined_file':
            setMyColor(data.color);
            setViewers(data.viewers || []);
            break;

          case 'presence_update':
            setViewers(data.data.viewers || []);
            break;

          case 'cursor_update':
            setCursors(prev => ({
              ...prev,
              [data.data.userId]: data.data
            }));
            break;

          case 'live_comment':
            setComments(prev => [...prev, data.data]);
            break;

          case 'comment_resolved':
            setComments(prev => 
              prev.map(c => c.id === data.data.commentId 
                ? { ...c, resolved: true } 
                : c
              )
            );
            break;

          case 'comment_deleted':
            setComments(prev => prev.filter(c => c.id !== data.data.commentId));
            break;
        }
      } catch (e) {
        // Silent fail for collaboration
      }
    };

    ws.addEventListener('message', handleMessage);

    // Heartbeat
    const heartbeat = setInterval(() => {
      ws.send(JSON.stringify({ type: 'heartbeat' }));
    }, 30000);

    return () => {
      ws.removeEventListener('message', handleMessage);
      clearInterval(heartbeat);
      
      // Leave file
      ws.send(JSON.stringify({
        type: 'leave_file',
        fileId
      }));
    };
  }, [ws, fileId]);

  // Scroll to bottom when new comments arrive
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSendComment = (e) => {
    e.preventDefault();
    if (!newComment.trim() || !ws) return;

    ws.send(JSON.stringify({
      type: 'live_comment',
      content: newComment.trim(),
      position: null // Could be cursor position
    }));

    // Check for mentions
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const mentionedUser = viewers.find(v => 
        v.username.toLowerCase() === match[1].toLowerCase()
      );
      if (mentionedUser && onMention) {
        onMention(mentionedUser, newComment);
      }
    }

    setNewComment('');
  };

  const handleMentionClick = (username) => {
    setNewComment(prev => prev + `@${username} `);
  };

  const otherViewers = viewers.filter(v => v.userId !== currentUser?.id);

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {/* Viewers Avatars */}
      <div className="flex items-center gap-2 mb-2">
        {otherViewers.length > 0 && (
          <div className="flex -space-x-2 rtl:space-x-reverse">
            {otherViewers.slice(0, 5).map((viewer) => (
              <div
                key={viewer.userId}
                className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center text-white text-xs font-bold cursor-pointer"
                style={{ backgroundColor: viewer.color }}
                title={viewer.username}
              >
                {viewer.username?.[0]?.toUpperCase()}
              </div>
            ))}
            {otherViewers.length > 5 && (
              <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-400 flex items-center justify-center text-white text-xs">
                +{otherViewers.length - 5}
              </div>
            )}
          </div>
        )}

        {/* Viewers count */}
        <div className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 rounded-full shadow text-sm">
          <Users className="w-4 h-4" />
          <span>{viewers.length}</span>
        </div>

        {/* Comments toggle */}
        <button
          onClick={() => setShowComments(!showComments)}
          className={`flex items-center gap-1 px-3 py-1 rounded-full shadow text-sm ${
            showComments 
              ? 'bg-blue-600 text-white' 
              : 'bg-white dark:bg-gray-800'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{comments.filter(c => !c.resolved).length}</span>
        </button>
      </div>

      {/* Comments Panel */}
      {showComments && (
        <div className="w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
            <h3 className="font-medium">التعليقات الحية</h3>
            <button
              onClick={() => setShowComments(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Online Users */}
          {otherViewers.length > 0 && (
            <div className="p-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <p className="text-xs text-gray-500 mb-1">متصلون الآن:</p>
              <div className="flex flex-wrap gap-1">
                {otherViewers.map((viewer) => (
                  <button
                    key={viewer.userId}
                    onClick={() => handleMentionClick(viewer.username)}
                    className="flex items-center gap-1 px-2 py-0.5 bg-white dark:bg-gray-600 rounded-full text-xs hover:bg-gray-100 dark:hover:bg-gray-500"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: viewer.color }}
                    />
                    {viewer.username}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comments List */}
          <div className="h-64 overflow-y-auto p-3 space-y-3">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                لا توجد تعليقات بعد
              </p>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-2 rounded-lg ${
                    comment.resolved 
                      ? 'bg-gray-100 dark:bg-gray-700/30 opacity-50' 
                      : 'bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: comment.color }}
                    >
                      {comment.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="text-sm font-medium">{comment.username}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(comment.createdAt).toLocaleTimeString('ar')}
                    </span>
                  </div>
                  <p className="text-sm pr-7">
                    {comment.content.split(/(@\w+)/g).map((part, i) => 
                      part.startsWith('@') ? (
                        <span key={i} className="text-blue-500 font-medium">{part}</span>
                      ) : part
                    )}
                  </p>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendComment} className="p-3 border-t dark:border-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقاً... استخدم @ للإشارة"
                className="flex-1 px-3 py-2 text-sm border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                type="submit"
                disabled={!newComment.trim()}
                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Remote Cursors (for text editors) */}
      {Object.values(cursors).map((cursor) => (
        cursor.userId !== currentUser?.id && cursor.position && (
          <div
            key={cursor.userId}
            className="fixed pointer-events-none z-50"
            style={{
              left: cursor.position.x,
              top: cursor.position.y,
              transform: 'translate(-2px, -2px)'
            }}
          >
            <div
              className="w-0.5 h-5"
              style={{ backgroundColor: cursor.color }}
            />
            <div
              className="px-1 py-0.5 text-xs text-white rounded whitespace-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.username}
            </div>
          </div>
        )
      ))}
    </div>
  );
}
