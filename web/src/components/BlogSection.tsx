import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Blog } from '../types';
import { ArrowLeft, BookOpen, Calendar, User, Tag, ChevronRight, Activity, MapPin, Trophy } from 'lucide-react';

interface BlogSectionProps {
  blogs: Blog[];
  selectedBlogId?: string;
  onBlogClick: (blogId: string) => void;
  onBackToBlogs: () => void;
}

export default function BlogSection({ blogs }: { blogs: Blog[] }) {
  const navigate = useNavigate();
  const { id: selectedBlogId } = useParams<{id: string}>();
  const [activeCategory, setActiveCategory] = useState<'Tất cả' | 'Đánh giá thiết bị' | 'Hướng dẫn kỹ thuật' | 'Đánh giá sân bãi' | 'Tin tức'>('Tất cả');

  const filteredBlogs = activeCategory === 'Tất cả'
    ? blogs
    : blogs.filter(b => b.category === activeCategory);

  const selectedBlog = blogs.find(b => b.id === selectedBlogId);

  // Category visual matching
  const catIcons = {
    'Đánh giá thiết bị': <Trophy className="w-3.5 h-3.5" />,
    'Hướng dẫn kỹ thuật': <Activity className="w-3.5 h-3.5" />,
    'Đánh giá sân bãi': <MapPin className="w-3.5 h-3.5" />,
    'Tin tức': <BookOpen className="w-3.5 h-3.5" />
  };

  if (selectedBlog) {
    // Elegant Editorial Reader View
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-in fade-in duration-300" id="blog-reader-view">
        <button
          onClick={() => navigate('/blog')}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-primary font-medium mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại danh mục tin tức
        </button>

        <article className="space-y-6">
          {/* Cover image */}
          <div className="aspect-[21/9] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-md">
            <img src={selectedBlog.image} alt={selectedBlog.title} className="w-full h-full object-cover" />
          </div>

          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] bg-black text-white font-bold px-2 py-1 uppercase tracking-widest">
              {selectedBlog.category}
            </span>
            <h1 className="font-display font-black text-2xl md:text-4xl text-gray-900 tracking-tight leading-tight">
              {selectedBlog.title}
            </h1>

            {/* Meta attributes */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 font-mono py-2 border-t border-b border-gray-100">
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-gray-300" /> Tác giả: <strong>{selectedBlog.author}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-300" /> Cập nhật: {selectedBlog.date}
              </span>
            </div>
          </div>

          {/* HTML-like content area with beautiful spacing and typography formatting */}
          <div className="prose max-w-none text-gray-700 leading-relaxed text-sm md:text-base space-y-4 whitespace-pre-line font-serif">
            {selectedBlog.content}
          </div>

          {/* Tag pills */}
          <div className="pt-6 border-t border-gray-100 flex flex-wrap items-center gap-2">
            <Tag className="w-4 h-4 text-gray-400" />
            {selectedBlog.tags.map((tag, idx) => (
              <span key={idx} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-md font-medium">
                #{tag}
              </span>
            ))}
          </div>
        </article>
      </div>
    );
  }

  // Blog Directory view with categorization
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-in fade-in duration-300" id="blog-directory">
      {/* Title */}
      <div className="text-center mb-10">
        <span className="text-xs bg-brand-light text-brand-primary font-bold px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest">
          Góc Kiến Thức & Đánh Giá
        </span>
        <h1 className="font-display font-black text-2xl md:text-4xl text-gray-900 tracking-tight mt-2">
          HỆ THỐNG TIN TỨC CHUYÊN SÂU <span className="text-brand-primary">CẦU LÔNG</span>
        </h1>
        <p className="text-xs md:text-sm text-gray-500 max-w-lg mx-auto mt-2">
          Nơi cập nhật đánh giá vợt thực tế từ các cao thủ, review chất lượng các cụm sân và hướng dẫn kỹ năng phòng tránh chấn thương hiệu quả nhất.
        </p>
      </div>

      {/* Categories select tabs */}
      <div className="flex justify-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {(['Tất cả', 'Đánh giá thiết bị', 'Hướng dẫn kỹ thuật', 'Đánh giá sân bãi', 'Tin tức'] as const).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-xs px-4 py-2 rounded-full border font-bold transition flex items-center gap-1.5 shrink-0 ${activeCategory === cat ? 'bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            {cat !== 'Tất cả' && catIcons[cat]}
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of articles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filteredBlogs.map(blog => (
          <div
            key={blog.id}
            onClick={() => navigate(`/blog/${blog.id}`)}
            className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-xs hover:shadow-sm transition cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="aspect-[16/10] overflow-hidden bg-gray-100">
                <img
                  src={blog.image}
                  alt={blog.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <div className="p-4 space-y-2">
                <span className="text-[10px] bg-black text-white font-bold px-2 py-1 uppercase tracking-widest">
                  {blog.category}
                </span>
                <h3 className="font-bold text-sm md:text-base text-gray-900 group-hover:text-brand-primary transition line-clamp-2 leading-snug">
                  {blog.title}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-3 leading-relaxed">
                  {blog.summary}
                </p>
              </div>
            </div>

            <div className="p-4 pt-0 border-t border-gray-50 mt-4 flex items-center justify-between text-xs font-mono text-gray-400">
              <span>{blog.date}</span>
              <span className="font-bold text-brand-primary flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                Đọc bài viết <ChevronRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
