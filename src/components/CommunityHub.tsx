import React, { useState } from 'react';
import {
  MessageSquare,
  Pin,
  Heart,
  Send,
  AlertTriangle,
  Sparkles,
  Share2,
  ShieldCheck,
  Image as ImageIcon,
  Paperclip,
  CheckCircle2,
  Users
} from 'lucide-react';
import type { CommunityPost, ChatMessage, User, Course } from '../types';
import { SymbolicAvatar } from './SymbolicAvatar';

interface CommunityHubProps {
  currentUser: User | null;
  posts: CommunityPost[];
  chatMessages: ChatMessage[];
  courses: Course[];
  onAddPost: (content: string, category: 'announcement' | 'community', mediaUrl?: string) => Promise<void>;
  onLikePost: (postId: string) => Promise<void>;
  onAddComment: (postId: string, content: string) => Promise<void>;
  onSendMessage: (content: string, courseId?: string, channelId?: string) => Promise<void>;
}

export const CommunityHub: React.FC<CommunityHubProps> = ({
  currentUser,
  posts,
  chatMessages,
  courses,
  onAddPost,
  onLikePost,
  onAddComment,
  onSendMessage,
}) => {
  const [hubTab, setHubTab] = useState<'feed' | 'chat'>('feed');
  const [feedFilter, setFeedFilter] = useState<'all' | 'announcements' | 'community'>('all');
  
  // Post Creator State
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<'announcement' | 'community'>('community');
  const [newPostMedia, setNewPostMedia] = useState('');
  const [postError, setPostError] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // Comment State per post
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');

  // WhatsApp-style Chat State
  const [selectedChannel, setSelectedChannel] = useState<string>('general');
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');

  const isAdminOrTeacher = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostContent.trim() || !currentUser) return;
    setPostError('');
    setIsPosting(true);
    try {
      await onAddPost(newPostContent.trim(), newPostCategory, newPostMedia || undefined);
      setNewPostContent('');
      setNewPostMedia('');
    } catch (err: any) {
      setPostError(err.message || 'Safety filter triggered. Content was blocked.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleSendComment = async (postId: string) => {
    if (!commentText.trim() || !currentUser) return;
    try {
      await onAddComment(postId, commentText.trim());
      setCommentText('');
      setActiveCommentPostId(null);
    } catch (err: any) {
      setPostError(err.message || 'Comment blocked by safety filter.');
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentUser) return;
    setChatError('');
    try {
      await onSendMessage(
        chatInput.trim(),
        selectedChannel.startsWith('course-')
          ? selectedChannel.slice('course-'.length)
          : undefined,
        selectedChannel
      );
      setChatInput('');
    } catch (err: any) {
      setChatError(err.message || 'Message blocked by real-time safety filter.');
    }
  };

  const displayedMessages = chatMessages.filter((msg) => {
    if (msg.channelId) {
      return msg.channelId === selectedChannel;
    }
    if (selectedChannel.startsWith('course-')) {
      return msg.courseId === selectedChannel.slice('course-'.length);
    }
    return selectedChannel === 'general';
  });

  const selectedCourseChannel = selectedChannel.startsWith('course-')
    ? courses.find((c) => c.id === selectedChannel.slice('course-'.length))
    : undefined;
  const selectedChannelLabel =
    selectedChannel === 'general'
      ? '# General Campus Hall'
      : selectedChannel === 'faculty-qna'
      ? '# Faculty Office Hours Q&A'
      : selectedCourseChannel
      ? `${selectedCourseChannel.code} · ${selectedCourseChannel.title}`
      : selectedChannel;

  const filteredPosts = posts.filter((p) => {
    if (feedFilter === 'announcements') return p.category === 'announcement';
    if (feedFilter === 'community') return p.category === 'community';
    return true;
  });

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-[#0F2942] to-[#0A192F] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#00F2FE] mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>AI Moderated Sanctuary · Real-Time Censorship Active</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Institutional Community & Messaging Hub
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Connect with faculty cohorts, share reflections, and collaborate in real-time academic discussions.
          </p>
        </div>

        {/* Tab Switcher: Facebook-style Wall vs WhatsApp-style Messaging */}
        <div className="flex p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setHubTab('feed')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all ${
              hubTab === 'feed'
                ? 'bg-[#00F2FE]/20 text-[#00F2FE]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Community Wall
          </button>
          <button
            type="button"
            onClick={() => setHubTab('chat')}
            className={`px-4 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              hubTab === 'chat'
                ? 'bg-[#10B981]/20 text-[#10B981]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Live Messaging
          </button>
        </div>
      </div>

      {/* FEED TAB */}
      {hubTab === 'feed' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Feed Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Post Creator */}
            {currentUser ? (
              <form onSubmit={handleCreatePost} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-start gap-3">
                  <SymbolicAvatar
                    gender={currentUser.gender}
                    avatarUrl={currentUser.avatarUrl}
                    name={`${currentUser.firstName} ${currentUser.lastName}`}
                    size="md"
                  />
                  <div className="flex-1">
                    <textarea
                      rows={3}
                      required
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Share an academic reflection, project question, or scholastic thought..."
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
                    />
                  </div>
                </div>

                {postError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/50 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{postError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs">
                    {isAdminOrTeacher && (
                      <select
                        value={newPostCategory}
                        onChange={(e) => setNewPostCategory(e.target.value as any)}
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-300 text-[11px]"
                      >
                        <option value="community">Community Wall</option>
                        <option value="announcement">Official Announcement</option>
                      </select>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isPosting || !newPostContent.trim()}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-[#00F2FE] hover:bg-[#00F2FE]/90 transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isPosting ? 'Filtering & Posting...' : 'Publish Post'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                Sign in to post reflections and comment on academic discussions.
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-1 bg-slate-900/60 rounded-xl border border-slate-800 text-xs">
              {[
                { key: 'all', label: 'All Discussions' },
                { key: 'announcements', label: 'Official Announcements' },
                { key: 'community', label: 'Student Wall' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFeedFilter(f.key as any)}
                  className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                    feedFilter === f.key
                      ? 'bg-[#00F2FE]/20 text-[#00F2FE]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Posts List */}
            <div className="space-y-4">
              {filteredPosts.map((post) => {
                const isLiked = currentUser ? post.likedByUserIds?.includes(currentUser.id) : false;
                return (
                  <div
                    key={post.id}
                    className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3"
                  >
                    {/* Author & Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <SymbolicAvatar
                          gender={post.authorGender}
                          avatarUrl={post.authorAvatar}
                          name={post.authorName}
                          size="md"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{post.authorName}</span>
                            {post.authorRole === 'admin' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                Chancellor
                              </span>
                            )}
                            {post.authorRole === 'teacher' && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#00F2FE]/20 text-[#00F2FE] border border-[#00F2FE]/40">
                                Faculty
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {new Date(post.createdAt).toLocaleDateString()} at{' '}
                            {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>

                      {post.pinned && (
                        <div className="flex items-center gap-1 text-[11px] font-mono text-amber-400">
                          <Pin className="w-3.5 h-3.5" />
                          <span>Pinned</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                      {post.content}
                    </p>

                    {/* Likes & Comments Toolbar */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={() => onLikePost(post.id)}
                          className={`flex items-center gap-1.5 transition-colors ${
                            isLiked ? 'text-rose-400 font-bold' : 'hover:text-rose-400'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-400' : ''}`} />
                          <span>{post.likes}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                          className="flex items-center gap-1.5 hover:text-white transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>{post.comments?.length || 0} Comments</span>
                        </button>
                      </div>
                    </div>

                    {/* Comments Section */}
                    {activeCommentPostId === post.id && (
                      <div className="pt-3 border-t border-slate-800/80 space-y-3">
                        {post.comments?.map((c) => (
                          <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-2.5 text-xs">
                            <SymbolicAvatar
                              gender={c.authorGender}
                              avatarUrl={c.authorAvatar}
                              name={c.authorName}
                              size="sm"
                            />
                            <div>
                              <div className="font-bold text-slate-300">{c.authorName}</div>
                              <div className="text-slate-400 mt-0.5">{c.content}</div>
                            </div>
                          </div>
                        ))}

                        {currentUser && (
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Write a respectful reply..."
                              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
                            />
                            <button
                              type="button"
                              onClick={() => handleSendComment(post.id)}
                              className="px-3 py-1.5 rounded-xl bg-[#00F2FE] text-slate-950 text-xs font-semibold"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Guidelines & Ethics */}
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 space-y-3 text-xs">
              <div className="font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                Institutional Code of Ethics
              </div>
              <p className="text-slate-400 leading-relaxed">
                Deen Hijrah Academia maintains a sanctuary of sacred knowledge. Discourse must reflect adab (etiquette), mutual respect, and intellectual sincerity.
              </p>
              <ul className="space-y-1.5 text-slate-400 pl-4 list-disc">
                <li>Automated censorship intercepts profanity, hate speech, and spam links.</li>
                <li>Violations are logged immediately to Administrator Mustaqeem.</li>
                <li>Direct messaging between students and instructors is strictly academic.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP-STYLE CHAT TAB */}
      {hubTab === 'chat' && (
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden grid grid-cols-1 md:grid-cols-3 h-[580px]">
          
          {/* Channels / Cohorts Sidebar */}
          <div className="border-r border-slate-800 bg-slate-950/60 p-4 space-y-3 overflow-y-auto">
            <div className="text-xs font-mono uppercase text-slate-400 tracking-wider">
              Chat Channels & Cohorts
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedChannel('general')}
                className={`w-full p-2.5 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                  selectedChannel === 'general'
                    ? 'bg-[#00F2FE]/20 text-[#00F2FE] font-bold border border-[#00F2FE]/40'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span># General Campus Hall</span>
                <span className="text-[10px] text-slate-500 font-mono">Sitewide</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedChannel('faculty-qna')}
                className={`w-full p-2.5 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                  selectedChannel === 'faculty-qna'
                    ? 'bg-[#00F2FE]/20 text-[#00F2FE] font-bold border border-[#00F2FE]/40'
                    : 'text-slate-300 hover:bg-slate-900'
                }`}
              >
                <span># Faculty Office Hours Q&A</span>
                <span className="text-[10px] text-emerald-400 font-mono">Live</span>
              </button>

              {courses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedChannel(`course-${c.id}`)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs transition-colors flex items-center justify-between ${
                    selectedChannel === `course-${c.id}`
                      ? 'bg-[#00F2FE]/20 text-[#00F2FE] font-bold border border-[#00F2FE]/40'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span className="truncate">{c.code} · {c.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Chat Conversation Area */}
          <div className="md:col-span-2 flex flex-col justify-between bg-[#0A192F]/80">
            {/* Chat Header */}
            <div className="p-3.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00F2FE]" />
                <span className="font-bold text-white truncate max-w-xs">
                  Channel: {selectedChannelLabel}
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#10B981] flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Moderation Active
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {displayedMessages.length > 0 ? (
                displayedMessages.map((msg) => {
                  const isMe = currentUser ? msg.senderId === currentUser.id : false;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1 ${
                          isMe
                            ? 'bg-gradient-to-r from-[#00F2FE]/25 to-[#10B981]/20 text-white border border-[#00F2FE]/40 rounded-br-none'
                            : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-bl-none'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] text-slate-400">
                          <span className="font-bold text-slate-300">{msg.senderName}</span>
                          <span className="font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Welcome to {selectedChannelLabel}. Send the first academic message!
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-800 bg-slate-950/80 space-y-2">
              {chatError && (
                <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-500/50 text-[11px] text-rose-300">
                  {chatError}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a real-time message (monitored for academic integrity)..."
                  className="flex-1 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00F2FE]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send
                </button>
              </div>
            </form>
          </div>

        </div>
      )}

    </div>
  );
};
