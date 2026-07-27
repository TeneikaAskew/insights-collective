import { useParams } from 'react-router-dom';
import { BlogPostForm } from '@/components/blog/BlogPostForm';

export default function EditBlogPost() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>Post ID not found</div>;
  }

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <BlogPostForm postId={id} />
    </div>
  );
}