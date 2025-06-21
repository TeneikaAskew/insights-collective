import EnhancedModuleContentEditor from './EnhancedModuleContentEditor';

interface LessonContentEditorProps {
  lessonId: string;
}

const LessonContentEditor = ({ lessonId }: LessonContentEditorProps) => {
  return (
    <div className="space-y-4">
      <div className="border-t pt-4">
        <h4 className="font-medium mb-4">Lesson Content Blocks</h4>
        <EnhancedModuleContentEditor lessonId={lessonId} />
      </div>
    </div>
  );
};

export default LessonContentEditor;