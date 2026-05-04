
import { useEffect } from 'react';
import { Book, BarChart2, Star, GraduationCap, PieChart, Award, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { motion, useAnimation } from 'framer-motion';
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
    primary: "bg-primary/10 text-primary border-primary/20",
    purple: "bg-purple-100 text-purple-600 border-purple-200",
    orange: "bg-orange-100 text-orange-600 border-orange-200",
    green: "bg-green-100 text-green-600 border-green-200",
    blue: "bg-blue-100 text-blue-600 border-blue-200",
    amber: "bg-amber-100 text-amber-600 border-amber-200"
  };

  return (
    <section className="py-24 relative bg-gradient-to-b from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
      {/* Background elements */}
      <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-b from-white to-transparent dark:from-gray-900 dark:to-transparent"></div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent"></div>
        <div className="absolute top-0 left-1/2 h-full w-px bg-gradient-to-b from-transparent via-primary/10 to-transparent"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 font-display">Your Data Science Learning Journey</h2>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Our carefully designed learning pathway helps you achieve your data science goals with structured progression. 
            Each step is optimized to maximize your learning potential and career advancement.
          </p>
        </div>

        <motion.div 
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={controls}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12"
        >
          {steps.map((step) => (
            <motion.div 
              key={step.number}
              variants={itemVariants}
              className="flex flex-col h-full"
            >
              <div className={`flex flex-col h-full items-start p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border ${step.number % 2 === 0 ? 'border-accent/20' : 'border-primary/20'} relative group hover:shadow-lg transition-all duration-300`}>
                <div className="absolute -top-4 -left-4 w-8 h-8 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-white font-bold shadow-md border-2 border-white dark:border-gray-800">
                  <div className="absolute inset-0.5 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
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
                
                {/* Background gradient animation on hover */}
                <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <div className="text-center mt-16">
          <Button 
            size="lg" 
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-medium px-8 py-6 h-auto text-lg rounded-full shadow-xl hover:shadow-primary/20 transform transition-all duration-300 hover:-translate-y-1"
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
