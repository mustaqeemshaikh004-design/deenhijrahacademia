import React, { useState } from 'react';
import {
  BookOpen,
  Clock,
  Plus,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Link2,
  Check,
  Calendar,
} from 'lucide-react';
import type { BlogPost, User } from '../types';
import { resolveMediaSrc } from '../assets/fallbacks';

interface ArticlesBlogProps {
  articles: BlogPost[];
  currentUser: User | null;
  onAddArticle: (article: Partial<BlogPost>) => Promise<void>;
  onSelectArticle?: (article: BlogPost) => void;
  theme?: 'dark' | 'light';
}

interface BlogArticlePageProps {
  article: BlogPost | null;
  allArticles: BlogPost[];
  isLoadingArticles?: boolean;
  onBackToBlogs: () => void;
  onSelectArticle: (article: BlogPost) => void;
  theme?: 'dark' | 'light';
}

function formatEditorialDate(iso?: string): string {
  if (!iso) return 'Current Term';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return 'Current Term';
  return dt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function splitParagraphs(text: string): string[] {
  const normalized = (text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const blocks = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;
  return normalized
    .split('\n')
    .map((p) => p.trim())
    .filter(Boolean);
}

export const BlogArticlePage: React.FC<BlogArticlePageProps> = ({
  article,
  allArticles,
  isLoadingArticles = false,
  onBackToBlogs,
  onSelectArticle,
  theme = 'dark',
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const isLight = theme === 'light';

  const handleCopyShareLink = () => {
    if (!article) return;
    try {
      const shareUrl = `${window.location.origin}${window.location.pathname}?tab=blog-detail&blog=${encodeURIComponent(article.id)}`;
      void navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Clipboard blocked in restricted sandbox
    }
  };

  if (!article) {
    if (isLoadingArticles) {
      return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6 animate-pulse">
          <div className={`h-8 w-36 rounded-lg ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-64 sm:h-80 w-full rounded-2xl ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-10 w-3/4 rounded-lg ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
          <div className={`h-40 w-full rounded-xl ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />
        </div>
      );
    }

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center space-y-5">
        <div
          className={`w-14 h-14 mx-auto rounded-2xl border flex items-center justify-center ${
            isLight
              ? 'bg-white border-slate-200 text-[#0284C7]'
              : 'bg-[#0A192F] border-slate-800 text-[#00F2FE]'
          }`}
        >
          <BookOpen className="w-6 h-6" />
        </div>
        <h1 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
          Article Not Found
        </h1>
        <p className={`text-sm ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          The requested scholastic publication could not be located in the current archive.
        </p>
        <button
          type="button"
          onClick={onBackToBlogs}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Articles
        </button>
      </div>
    );
  }

  const paragraphs = splitParagraphs(article.content);
  const relatedArticles = allArticles.filter((a) => a.id !== article.id).slice(0, 3);
  const articleTabHref = `?tab=blog-detail&blog=${encodeURIComponent(article.id)}`;

  return (
    <article
      className={`min-h-[calc(100vh-4rem)] pb-16 transition-colors ${
        isLight ? 'bg-slate-50 text-slate-900' : 'bg-[#071120] text-slate-100'
      }`}
    >
      {/* Curatorial Editorial Utility Header */}
      <div
        className={`border-b transition-colors ${
          isLight ? 'bg-white/80 border-slate-200' : 'bg-[#091527]/80 border-slate-800/80'
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3 text-xs">
          <button
            type="button"
            onClick={onBackToBlogs}
            className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
              isLight
                ? 'text-slate-600 hover:text-[#0284C7]'
                : 'text-slate-300 hover:text-[#00F2FE]'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Articles</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </button>

            <a
              href={articleTabHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors ${
                isLight
                  ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-[#0284C7]'
                  : 'bg-[#0F2942] hover:bg-[#143556] border-[#00F2FE]/30 text-[#00F2FE]'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Tab</span>
            </a>
          </div>
        </div>
      </div>

      {/* Article Hero Masthead & Title Block */}
      <header className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-5">
        <div
          className={`text-[11px] font-mono uppercase tracking-[0.16em] flex flex-wrap items-center gap-2 ${
            isLight ? 'text-[#0284C7]' : 'text-[#00F2FE]'
          }`}
        >
          <span>Scholastic Publication</span>
          {article.tags.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>
                {article.tags.join(' · ')}
              </span>
            </>
          )}
        </div>

        <h1
          className={`text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight leading-[1.16] ${
            isLight ? 'text-slate-900' : 'text-white'
          }`}
        >
          {article.title}
        </h1>

        {article.excerpt && (
          <p
            className={`text-base sm:text-lg leading-relaxed max-w-3xl ${
              isLight ? 'text-slate-600' : 'text-slate-300'
            }`}
          >
            {article.excerpt}
          </p>
        )}

        {/* Unboxed Byline Metadata Bar */}
        <div
          className={`pt-4 pb-6 border-b flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm ${
            isLight
              ? 'border-slate-200 text-slate-600'
              : 'border-slate-800 text-slate-400'
          }`}
        >
          <span className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            {article.authorName}
          </span>
          <span aria-hidden="true">·</span>
          <span className={isLight ? 'text-amber-700 font-medium' : 'text-amber-300 font-medium'}>
            {article.authorBadge}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            <Calendar className="w-3.5 h-3.5" />
            {formatEditorialDate(article.publishedAt)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            <Clock className="w-3.5 h-3.5" />
            {article.readTime}
          </span>
        </div>
      </header>

      {/* Framed Editorial Banner Artwork */}
      <figure className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div
          className={`relative w-full h-60 sm:h-80 md:h-[400px] rounded-2xl overflow-hidden border ${
            isLight ? 'border-slate-200 bg-slate-100 shadow-sm' : 'border-slate-800 bg-slate-900'
          }`}
        >
          <img
            src={resolveMediaSrc(article.bannerUrl, 'blog')}
            alt={article.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <figcaption
          className={`mt-2.5 text-xs italic font-mono ${
            isLight ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          Deen Hijrah Academia Editorial Archive · {article.authorName}
        </figcaption>
      </figure>

      {/* Focused Reading Measure Column (65-75ch) */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <div className="space-y-6">
          {paragraphs.map((para, index) => (
            <p
              key={index}
              className={`text-base sm:text-[17px] leading-[1.85] ${
                isLight ? 'text-slate-800' : 'text-slate-200'
              } ${
                index === 0
                  ? 'first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:leading-none ' +
                    (isLight
                      ? 'first-letter:text-[#0284C7]'
                      : 'first-letter:text-[#00F2FE]')
                  : ''
              }`}
            >
              {para}
            </p>
          ))}
        </div>

        {/* Endnote Signature */}
        <div
          className={`mt-12 pt-6 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isLight ? 'border-slate-200' : 'border-slate-800'
          }`}
        >
          <div>
            <div className={`text-xs uppercase tracking-widest font-mono ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              Published by
            </div>
            <div className={`text-sm font-bold mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {article.authorName} — {article.authorBadge}
            </div>
          </div>

          <button
            type="button"
            onClick={onBackToBlogs}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-colors ${
              isLight
                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Return to Articles Index
          </button>
        </div>
      </div>

      {/* Continue Reading Section */}
      {relatedArticles.length > 0 && (
        <section
          className={`max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-14 pt-10 border-t ${
            isLight ? 'border-slate-200' : 'border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <div
                className={`text-[11px] font-mono uppercase tracking-widest ${
                  isLight ? 'text-[#0284C7]' : 'text-[#00F2FE]'
                }`}
              >
                Academy Journal
              </div>
              <h2 className={`text-xl font-bold mt-0.5 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Continue Reading
              </h2>
            </div>
            <button
              type="button"
              onClick={onBackToBlogs}
              className={`text-xs font-semibold inline-flex items-center gap-1 ${
                isLight ? 'text-[#0284C7] hover:underline' : 'text-[#00F2FE] hover:underline'
              }`}
            >
              View All <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {relatedArticles.map((rel) => (
              <button
                key={rel.id}
                type="button"
                onClick={() => onSelectArticle(rel)}
                className={`text-left group rounded-2xl border overflow-hidden transition-all duration-200 flex flex-col justify-between ${
                  isLight
                    ? 'bg-white border-slate-200 hover:border-sky-300 shadow-xs'
                    : 'bg-slate-900/70 border-slate-800 hover:border-[#00F2FE]/40'
                }`}
              >
                <div className="h-36 w-full overflow-hidden">
                  <img
                    src={resolveMediaSrc(rel.bannerUrl, 'blog')}
                    alt={rel.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <h3
                    className={`text-sm font-bold leading-snug line-clamp-2 ${
                      isLight
                        ? 'text-slate-900 group-hover:text-[#0284C7]'
                        : 'text-white group-hover:text-[#00F2FE]'
                    }`}
                  >
                    {rel.title}
                  </h3>
                  <div className={`text-[11px] font-mono flex items-center justify-between pt-2 border-t ${
                    isLight ? 'border-slate-100 text-slate-500' : 'border-slate-800 text-slate-400'
                  }`}>
                    <span>{rel.authorName}</span>
                    <span>{rel.readTime}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </article>
  );
};

export const ArticlesBlog: React.FC<ArticlesBlogProps> = ({
  articles,
  currentUser,
  onAddArticle,
  onSelectArticle,
  theme = 'dark',
}) => {
  const [fallbackArticle, setFallbackArticle] = useState<BlogPost | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [readTime, setReadTime] = useState('4 min read');
  const [bannerUrl, setBannerUrl] = useState('fallback://blog');

  const isAdmin = currentUser?.role === 'admin';
  const isLight = theme === 'light';

  if (fallbackArticle) {
    return (
      <BlogArticlePage
        article={fallbackArticle}
        allArticles={articles}
        onBackToBlogs={() => setFallbackArticle(null)}
        onSelectArticle={(art) => setFallbackArticle(art)}
        theme={theme}
      />
    );
  }

  const handleOpenArticle = (art: BlogPost) => {
    if (onSelectArticle) {
      onSelectArticle(art);
    } else {
      setFallbackArticle(art);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    await onAddArticle({
      title,
      excerpt,
      content,
      readTime,
      bannerUrl,
      authorName: currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Mustaqeem Shaikh',
      authorBadge: 'Founding Chancellor',
      tags: ['Scholarship', 'Academics'],
    });
    setShowAddModal(false);
    setTitle('');
    setExcerpt('');
    setContent('');
  };

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div
        className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
          isLight
            ? 'bg-white border-slate-200 shadow-sm'
            : 'bg-gradient-to-r from-[#0F2942] to-[#0A192F] border-slate-800'
        }`}
      >
        <div>
          <div
            className={`text-xs font-mono uppercase tracking-wider mb-1 ${
              isLight ? 'text-[#0284C7]' : 'text-[#00F2FE]'
            }`}
          >
            Institutional Publications
          </div>
          <h2
            className={`text-xl sm:text-2xl font-bold tracking-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            Scholastic Articles &amp; Announcements
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
            Scholarly insights, classical treatises, and pedagogical directives from Founding Director Mustaqeem Shaikh.
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981] hover:brightness-110 transition-all shadow-[0_0_15px_rgba(0,242,254,0.3)] flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Publish Article
          </button>
        )}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((art) => (
          <article
            key={art.id}
            onClick={() => handleOpenArticle(art)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpenArticle(art);
              }
            }}
            role="button"
            tabIndex={0}
            className={`group cursor-pointer rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00F2FE]/60 ${
              isLight
                ? 'bg-white border-slate-200 hover:border-sky-300 hover:shadow-md'
                : 'bg-slate-900/70 border-slate-800 hover:border-[#00F2FE]/40'
            }`}
          >
            <div className="relative h-44 overflow-hidden">
              <img
                src={resolveMediaSrc(art.bannerUrl, 'blog')}
                alt={art.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-black/20" />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-wider text-slate-100">
                <span className="truncate">{art.tags.join(' · ')}</span>
                <a
                  href={`?tab=blog-detail&blog=${encodeURIComponent(art.id)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open article in a new browser tab"
                  className="p-1.5 rounded-lg bg-slate-950/70 hover:bg-slate-950 text-[#00F2FE] border border-white/10 shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3
                  className={`text-base font-bold transition-colors leading-snug ${
                    isLight
                      ? 'text-slate-900 group-hover:text-[#0284C7]'
                      : 'text-white group-hover:text-[#00F2FE]'
                  }`}
                >
                  {art.title}
                </h3>
                <p
                  className={`mt-2 text-xs line-clamp-3 leading-relaxed ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {art.excerpt}
                </p>
              </div>

              <div
                className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                  isLight
                    ? 'border-slate-100 text-slate-600'
                    : 'border-slate-800/80 text-slate-400'
                }`}
              >
                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                  {art.authorName}
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {art.readTime}
                  </span>
                  <span className={isLight ? 'text-[#0284C7]' : 'text-[#00F2FE]'}>Read &rarr;</span>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Add Article Modal (Admin Only) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div
            className={`relative w-full max-w-xl rounded-3xl border p-6 sm:p-8 space-y-4 max-h-[90vh] overflow-y-auto ${
              isLight
                ? 'bg-white border-slate-200 text-slate-900'
                : 'bg-[#0A192F] border-slate-700 text-slate-100'
            }`}
          >
            <h3 className="text-lg font-bold">Publish Scholastic Article</h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Excerpt
                </label>
                <input
                  type="text"
                  required
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-white'
                  }`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  Article Body
                </label>
                <textarea
                  rows={5}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-slate-950 border-slate-700 text-white'
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Read Time
                  </label>
                  <input
                    type="text"
                    value={readTime}
                    onChange={(e) => setReadTime(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    Banner Image URL
                  </label>
                  <input
                    type="text"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900'
                        : 'bg-slate-950 border-slate-700 text-white'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className={`px-4 py-2 text-xs ${
                    isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F2FE] to-[#10B981]"
                >
                  Publish Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
