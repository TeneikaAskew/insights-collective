
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CTASection = () => {
  return (
    <section className="py-16 bg-gradient-to-r from-learnflow-600 to-learnflow-800 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Start Learning?</h2>
        <p className="text-xl max-w-2xl mx-auto mb-8">
          Join thousands of students already learning on Insights Collective. Sign up today and take the first step towards your educational goals.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" variant="secondary" asChild>
            <Link to="/register">Create Free Account</Link>
          </Button>
          <Button size="lg" className="bg-learnflow-600 text-white hover:bg-learnflow-700" asChild>
            <Link to="/login">Log in to view Dashboard</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
