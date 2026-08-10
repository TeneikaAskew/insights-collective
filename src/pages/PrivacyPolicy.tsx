import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import PageSeo from '@/components/seo/PageSeo';

const PrivacyPolicy: React.FC = () => {
  return (
    <AppLayout>
      <PageSeo
        title="Privacy Policy | Insights Collective"
        description="How Insights Collective collects, uses and protects learner data across courses, assessments and career tools."
        path="/privacy-policy"
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <h1 className="text-3xl font-bold text-center">Privacy Policy</h1>
            <p className="text-center text-muted-foreground">Last updated: December 2024</p>

          </CardHeader>
          <CardContent className="prose prose-slate max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Information We Collect</h2>
              <p className="mb-4">
                We collect information you provide directly to us and information automatically collected when you use our service.
              </p>
              
              <h3 className="text-xl font-semibold mb-2">Information You Provide:</h3>
              <ul className="list-disc pl-6 mb-4">
                <li>Account registration information (name, email, password)</li>
                <li>Profile information (career goals, skills, experience)</li>
                <li>Resume and portfolio content</li>
                <li>Assessment and quiz responses</li>
                <li>Messages and communications through our platform</li>
                <li>Feedback and survey responses</li>
              </ul>

              <h3 className="text-xl font-semibold mb-2">Automatically Collected Information:</h3>
              <ul className="list-disc pl-6 mb-4">
                <li>Usage data and analytics</li>
                <li>Device information and IP address</li>
                <li>Browser type and version</li>
                <li>Pages visited and time spent on the platform</li>
                <li>Referral sources</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. How We Use Your Information</h2>
              <p className="mb-4">We use the collected information to:</p>
              <ul className="list-disc pl-6 mb-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Create personalized career recommendations</li>
                <li>Analyze resumes and provide improvement suggestions</li>
                <li>Generate career pathway reports and action plans</li>
                <li>Facilitate communication between users and mentors</li>
                <li>Send important service updates and notifications</li>
                <li>Conduct research to improve our algorithms and services</li>
                <li>Ensure security and prevent fraud</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Information Sharing and Disclosure</h2>
              <p className="mb-4">
                We do not sell, trade, or rent your personal information to third parties. We may share your information in the following circumstances:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li><strong>With your consent:</strong> When you explicitly agree to share information</li>
                <li><strong>Service providers:</strong> Third-party vendors who assist in operating our platform</li>
                <li><strong>Legal requirements:</strong> When required by law or to protect our rights</li>
                <li><strong>Business transfers:</strong> In connection with mergers, acquisitions, or asset sales</li>
                <li><strong>Public portfolios:</strong> Information you choose to make public in your portfolio</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Data Security</h2>
              <p className="mb-4">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Regular security assessments and updates</li>
                <li>Access controls and authentication requirements</li>
                <li>Secure hosting and database management</li>
                <li>Regular backups and disaster recovery procedures</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Data Retention</h2>
              <p className="mb-4">
                We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Specifically:
              </p>
              <ul className="list-disc pl-6 mb-4">
                <li>Account information: Until you delete your account</li>
                <li>Usage data: Up to 3 years for analytics purposes</li>
                <li>Assessment results: Until you request deletion</li>
                <li>Communications: As required for customer support</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Your Rights and Choices</h2>
              <p className="mb-4">You have the following rights regarding your personal information:</p>
              <ul className="list-disc pl-6 mb-4">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Objection:</strong> Object to certain processing of your information</li>
                <li><strong>Restriction:</strong> Request limitation of processing</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Cookies and Tracking Technologies</h2>
              <p className="mb-4">
                We use cookies and similar technologies to enhance your experience, analyze usage, and provide personalized content. You can control cookie settings through your browser preferences.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Children's Privacy</h2>
              <p className="mb-4">
                Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware of such collection, we will take steps to delete the information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
              <p className="mb-4">
                Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place for such transfers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Changes to This Privacy Policy</h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page with an updated effective date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
              <p className="mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us through our support channels available on the platform.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PrivacyPolicy;