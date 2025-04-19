
import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// Placeholders for components that would need to be created
const CareerRecommendationCard = ({ role }: { role: string }) => (
  <Card className="w-full max-w-md mx-auto bg-amber-50 shadow-md">
    <CardHeader>
      <CardTitle className="text-2xl text-amber-600">{role}</CardTitle>
      <CardDescription>
        This is a recommended career based on your skills and interests.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p>
        A brief description of this role and why it fits your skills.
      </p>
    </CardContent>
    <CardFooter>
      <Button size="sm" variant="outline">Explore Role</Button>
    </CardFooter>
  </Card>
);

const RoadmapStep = ({ step, active }: { step: string; active: boolean }) => (
  <div
    className={`p-4 mb-3 rounded-lg border transition-colors ${
      active ? "border-amber-500 bg-amber-100" : "border-gray-200 bg-white"
    }`}
  >
    <p className="font-semibold">{step}</p>
  </div>
);

const stepTitles = [
  "Skill & Interest Assessment",
  "Career Recommendation",
  "Suggested Roadmap",
  "Personalized Dashboard",
];

const dummyCareers = ["Software Engineer", "Data Scientist", "UX Designer"];

const dummyRoadmapSteps = [
  "Learn fundamentals of programming",
  "Build personal projects",
  "Contribute to open source",
  "Apply to internships",
  "Secure a full-time role",
];

interface SkillInterestData {
  skills: string;
  interests: string;
  goals: string;
}

const CareerAgent: React.FC = () => {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [skillInterestData, setSkillInterestData] = useState<SkillInterestData>({
    skills: "",
    interests: "",
    goals: "",
  });

  // For demo, recommendations shown in step 1
  // Roadmap shown in step 2
  // Dashboard shown in step 3

  const nextStep = () => {
    if (step < stepTitles.length - 1) {
      setStep(step + 1);
      setProgress(((step + 1) / (stepTitles.length - 1)) * 100);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
      setProgress(((step - 1) / (stepTitles.length - 1)) * 100);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen">
      <h1 className="text-4xl font-bold text-amber-600 mb-4">Career Pathway Agent</h1>
      <p className="mb-6 text-muted-foreground max-w-xl">
        Let’s guide your career step-by-step with personalized recommendations.
      </p>

      <Progress value={progress} className="mb-8" />

      <AnimatePresence mode="wait" initial={false}>
        {step === 0 && (
          <motion.div
            key="assessment"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>{stepTitles[0]}</CardTitle>
                <CardDescription>Tell us about your skills, interests, and career goals.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="skills">Skills</Label>
                  <Textarea
                    id="skills"
                    placeholder="E.g., JavaScript, Data Analysis, UX Design"
                    value={skillInterestData.skills}
                    onChange={(e) => setSkillInterestData({...skillInterestData, skills: e.target.value})}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="interests">Interests</Label>
                  <Textarea
                    id="interests"
                    placeholder="E.g., Machine Learning, Frontend Development"
                    value={skillInterestData.interests}
                    onChange={(e) => setSkillInterestData({...skillInterestData, interests: e.target.value})}
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="goals">Career Goals</Label>
                  <Textarea
                    id="goals"
                    placeholder="E.g., Become a Team Lead, Work in AI"
                    value={skillInterestData.goals}
                    onChange={(e) => setSkillInterestData({...skillInterestData, goals: e.target.value})}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 1 && (
          <motion.div
            key="recommendations"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>{stepTitles[1]}</CardTitle>
                <CardDescription>Based on your inputs, we recommend these careers:</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dummyCareers.map((role) => (
                  <CareerRecommendationCard key={role} role={role} />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="roadmap"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>{stepTitles[2]}</CardTitle>
                <CardDescription>Your suggested roadmap to reach your career goals:</CardDescription>
              </CardHeader>
              <CardContent>
                {dummyRoadmapSteps.map((stepLabel, idx) => (
                  <RoadmapStep key={idx} step={stepLabel} active={true} />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <Card className="p-6">
              <CardHeader>
                <CardTitle>{stepTitles[3]}</CardTitle>
                <CardDescription>Your personalized dashboard overview.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-4 font-semibold">
                  Welcome to your career dashboard! Here's your next action list.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Complete your profile</li>
                  <li>Review recommended career paths</li>
                  <li>Start applying for internships</li>
                  <li>Schedule a mentorship session</li>
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-between mt-8 space-x-4">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={step === 0}
          aria-label="Previous step"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button
          onClick={nextStep}
          disabled={
            (step === 0 &&
              (!skillInterestData.skills.trim() ||
                !skillInterestData.interests.trim() ||
                !skillInterestData.goals.trim())) ||
            step === stepTitles.length - 1
          }
          aria-label="Next step"
        >
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default CareerAgent;
