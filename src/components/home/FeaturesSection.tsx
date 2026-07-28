
import { BookOpen, GraduationCap, Award, Layers } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, description }: { 
  icon: React.ElementType; 
  title: string; 
  description: string 
}) => (
  <div className="flex flex-col items-center text-center p-6 ss-tile">
    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
      <Icon className="h-7 w-7 text-primary" />
    </div>
    <h3 className="text-xl font-semibold mb-2">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

const FeaturesSection = () => {
  const features = [
    {
      icon: BookOpen,
      title: "Structured Learning",
      description: "Courses organized into weekly modules for effective learning progression"
    },
    {
      icon: Layers,
      title: "Comprehensive Content",
      description: "Access lessons, assignments, quizzes, and interactive materials"
    },
    {
      icon: GraduationCap,
      title: "Expert Instructors",
      description: "Learn from industry professionals with real-world experience"
    },
    {
      icon: Award,
      title: "Certification",
      description: "Earn certificates upon successful completion of courses"
    }
  ];

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">Why Choose Insights Collective?</h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <FeatureCard 
              key={index}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
