
import { useEffect } from 'react';
import { Book, BarChart2, Star, GraduationCap, PieChart, Award, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { m, useAnimation } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

const LearningJourney = () => {
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) {
      controls.start('visible');
    }
  }, [controls, inView]);

  // Define step data
  const steps = [
    {
      number: 1,
      title: "Choose Your Path",
      description: "Explore our curriculum offerings in Data Engineering, AI/ML, Analytics, or Business Intelligence based on your interests and career goals.",
      icon: Book,
      color: "primary",
      link: "/courses",
      linkText: "Explore Paths"
    },
    {
      number: 2,
      title: "Personalized Learning",
      description: "Receive AI-generated recommendations tailored to your skill level, learning style, and career objectives in the data science field.",
      icon: BarChart2,
      color: "purple",
      link: "/explore-data-careers",
      linkText: "Take Assessment"
    },
    {
      number: 3,
      title: "Master Fundamentals",
      description: "Build a strong foundation with our core courses in statistics, programming, and data manipulation - essential skills for any data professional.",
      icon: Star,
      color: "orange",
      link: "/courses",
      linkText: "Browse Courses"
    },
    {
      number: 4,
      title: "Applied Projects",
      description: "Apply your knowledge to real-world scenarios through hands-on projects and gain practical experience valued by employers.",
      icon: GraduationCap,
      color: "green",
      link: "/courses",
      linkText: "Browse Projects"
    },
    {
      number: 5,
      title: "Track Progress",
      description: "Monitor your skill development, course completion, and assessment results with our comprehensive analytics dashboard.",
      icon: PieChart,
      color: "blue",
      link: "/dashboard",
      linkText: "View Dashboard"
    },
    {
      number: 6,
      title: "Earn Certification",
      description: "Showcase your expertise with industry-recognized certifications and enhance your professional profile in the data science field.",
      icon: Award,
      color: "amber",
      link: "/courses",
      linkText: "View Certifications"
    }
  ];

  // Create variants for animations
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 50 }
    }
  };

  // Color mapping
  const colorClasses = {
    primary: "bg-ss-lav-chip text-ss-lav-deep border-border",
    purple: "bg-ss-lav-chip text-ss-lav-deep border-border",
    orange: "bg-ss-warn-chip text-ss-peach-deep border-border",
    green: "bg-ss-good-chip text-ss-good border-border",
    blue: "bg-ss-teal-chip text-ss-teal border-border",
    amber: "bg-ss-warn-chip text-ss-warn border-border"
  };

  return (
    <section className="py-24 relative ss-wash">
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Your Data Science Learning Journey</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Our carefully designed learning pathway helps you achieve your data science goals with structured progression. 
            Each step is optimized to maximize your learning potential and career advancement.
          </p>
        </div>

        <m.div 
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={controls}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12"
        >
          {steps.map((step) => (
            <m.div 
              key={step.number}
              variants={itemVariants}
              className="flex flex-col h-full"
            >
              <div className="flex flex-col h-full items-start p-6 bg-card rounded-xl shadow-md border border-border relative group hover:shadow-lg transition-shadow duration-300">
                <div className="absolute -top-4 -left-4 w-8 h-8 bg-card rounded-full flex items-center justify-center text-primary-foreground font-bold shadow-md border-2 border-background">
                  <div className="absolute inset-0.5 rounded-full bg-primary flex items-center justify-center">
                    {step.number}
                  </div>
                </div>
                
                <div className={`w-14 h-14 rounded-full ${colorClasses[step.color]} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon className="h-7 w-7" />
                </div>
                
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground mb-6 flex-grow">
                  {step.description}
                </p>
                
                <div className="mt-auto">
                  <Link to={step.link} className="text-primary font-medium flex items-center hover:underline group-hover:translate-x-1 transition-transform duration-300">
                    {step.linkText} <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </m.div>
          ))}
        </m.div>

        <div className="text-center mt-16">
          <Button 
            size="lg" 
            className="font-medium px-8 py-6 h-auto text-lg rounded-full shadow-lg transform transition-all duration-300 hover:-translate-y-1"
            asChild
          >
            <Link to="/courses">
              Start Your Learning Journey <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LearningJourney;
