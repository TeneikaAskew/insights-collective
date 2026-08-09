import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import PageSeo from '@/components/seo/PageSeo';

const TermsOfService: React.FC = () => {
  return (
    <AppLayout>
      <PageSeo
        title="Terms of Service | Insights Collective"
        description="The terms that govern your use of Insights Collective's courses, career tools and community features."
        path="/terms-of-service"
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <h1 className="text-3xl font-bold text-center">Terms of Service</h1>
            <p className="text-center text-muted-foreground">Last updated: December 2024</p>

          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="mb-4">
                By accessing and using this career development platform, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, you should not use this service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
              <p className="mb-4">
                Our platform provides career development tools, resources, and guidance including but not limited to:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Career pathway assessments and recommendations</li>
                <li>Resume analysis and improvement suggestions</li>
                <li>Portfolio creation and management tools</li>
                <li>Interview preparation resources</li>
                <li>Educational content and courses</li>
                <li>AI-powered career coaching assistance</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. User Accounts</h2>
              <p className="mb-4">
                To access certain features of the service, you must register for an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. User Content and Conduct</h2>
              <p className="mb-4">
                You are responsible for all content you submit, post, or display on the service. You agree not to:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Submit false, misleading, or inappropriate information</li>
                <li>Violate any laws or regulations</li>
                <li>Infringe on intellectual property rights of others</li>
                <li>Upload malicious code or attempt to disrupt the service</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Use the service for commercial purposes without authorization</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Privacy and Data Protection</h2>
              <p className="mb-4">
                Your privacy is important to us. Our collection and use of personal information is governed by our Privacy Policy, which is incorporated into these terms by reference.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
              <p className="mb-4">
                The service and its original content, features, and functionality are owned by us and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Disclaimer of Warranties</h2>
              <p className="mb-4">
                The service is provided "as is" and "as available" without warranties of any kind. We do not warrant that the service will be uninterrupted, error-free, or free from harmful components.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
              <p className="mb-4">
                To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
              <p className="mb-4">
                We may terminate or suspend your account and access to the service immediately, without prior notice, for any reason, including breach of these terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these terms at any time. We will notify users of significant changes by posting the new terms on this page with an updated effective date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Contact Information</h2>
              <p className="mb-4">
                If you have any questions about these Terms of Service, please contact us through our support channels available on the platform.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default TermsOfService;