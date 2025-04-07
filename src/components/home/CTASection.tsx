
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const CTASection = () => {
  return (
    <section className="py-16 bg-gradient-to-r from-orange-600 to-purple-600 text-white">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Start Learning?</h2>
        <p className="text-xl max-w-2xl mx-auto mb-8">
          Join thousands of students already learning on Insights Collective. Sign up today and take the first step towards your educational goals.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" variant="secondary" asChild className="bg-purple-600 hover:bg-purple-700 text-white">
            <Link to="/register">Create Free Account</Link>
          </Button>
          <Button size="lg" className="bg-orange-600 hover:bg-orange-700 text-white" asChild>
            <Link to="/login">Log in to view Dashboard</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
