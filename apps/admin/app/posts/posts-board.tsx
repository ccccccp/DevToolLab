"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { decodeHtmlEntities, type PostRecord } from "@devtoollab/shared";

const PAGE_SIZE = 30;

type PostsBoardProps = {
  posts: PostRecord[];
};

function badgeText(post: PostRecord) {
  return post.status === "published" ? "已发布" : "草稿";
}

export function PostsBoard({ posts }: PostsBoardProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");
  const [page, setPage] = useState(1);

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesKeyword =
        !keyword ||
        decodeHtmlEntities(post.title).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(post.summary).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(post.category).toLowerCase().includes(keyword) ||
        post.tags.some((tag) => decodeHtmlEntities(tag).toLowerCase().includes(keyword));
      const matchesStatus = statusFilter === "all" || post.status === statusFilter;
      const matchesFeatured =
        featuredFilter === "all" ||
        (featuredFilter === "featured" && post.featured) ||
        (featuredFilter === "normal" && !post.featured);

      return matchesKeyword && matchesStatus && matchesFeatured;
    });
  }, [featuredFilter, posts, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + PAGE_SIZE);

  function handleQueryChange(value: string) {
    setQuery(value);
    setPage(1);
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  function handleFeaturedChange(value: string) {
    setFeaturedFilter(value);
    setPage(1);
  }

  return (
    <>
      <div className="section-header posts-section-header">
        <div>
          <span className="eyebrow">文章管理</span>
          <div className="section-title-row">
            <h1>最小 CMS：文章列表、创建和编辑</h1>
            <span className="section-count">{filteredPosts.length} 条</span>
          </div>
          <p className="muted">当前文章数据已经迁到 D1，通过 Worker API 读写。列表支持分页、状态筛选和关键词搜索。</p>
        </div>
        <Link href="/posts/new" className="button primary-button">
          新建文章
        </Link>
      </div>

      <div className="filter-bar posts-filter-bar">
        <label className="filter-field">
          <span>搜索</span>
          <input
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            placeholder="标题 / 摘要 / 分类 / 标签"
          />
        </label>
        <label className="filter-field">
          <span>状态</span>
          <select value={statusFilter} onChange={(event) => handleStatusChange(event.target.value)}>
            <option value="all">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
          </select>
        </label>
        <label className="filter-field">
          <span>推荐</span>
          <select value={featuredFilter} onChange={(event) => handleFeaturedChange(event.target.value)}>
            <option value="all">全部文章</option>
            <option value="featured">仅推荐</option>
            <option value="normal">非推荐</option>
          </select>
        </label>
      </div>

      <div className="posts-toolbar">
        <p className="meta-line">
          共 {posts.length} 条文章，当前第 {currentPage} / {totalPages} 页，每页 {PAGE_SIZE} 条。
        </p>
        <div className="pagination-row">
          <button
            type="button"
            className="button"
            disabled={currentPage <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            上一页
          </button>
          <button
            type="button"
            className="button"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            下一页
          </button>
        </div>
      </div>

      <div className="list-grid">
        {paginatedPosts.length > 0 ? (
          paginatedPosts.map((post) => (
            <article className="card compact-card" key={post.id}>
              <div className="badge-row">
                <span className={`status ${post.status}`}>{badgeText(post)}</span>
                {post.featured ? <span className="status featured">推荐</span> : null}
              </div>
              <h3>{decodeHtmlEntities(post.title)}</h3>
              <p className="muted">{decodeHtmlEntities(post.summary)}</p>
              <p className="meta-line">分类：{decodeHtmlEntities(post.category)}</p>
              <p className="meta-line">标签：{post.tags.length > 0 ? post.tags.join(" / ") : "无"}</p>
              <p className="meta-line">更新时间：{new Date(post.updatedAt).toLocaleString("zh-CN")}</p>
              <Link href={`/posts/${post.slug}`} className="text-link">
                编辑文章
              </Link>
            </article>
          ))
        ) : (
          <article className="card compact-card empty-card">
            <h3>没有匹配的文章</h3>
            <p className="muted">调整搜索词或筛选条件后再试。</p>
          </article>
        )}
      </div>
    </>
  );
}
