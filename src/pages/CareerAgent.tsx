import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useStorageUpload } from "@/hooks/useStorageUpload";

const stepTitles = [
  "Skill & Interest Assessment",
  "Resume Upload",
  "Career Recommendation",
  "Personalized Dashboard",
];

const assessmentQuestions = [
  {
    id: "skills",
    label: "Skills",
    placeholder: "E.g., JavaScript, Data Analysis, UX Design",
  },
  {
    id: "interests",
    label: "Interests",
    placeholder: "E.g., Machine Learning, Frontend Development",
  },
  {
    id: "goals",
    label: "Career Goals",
    placeholder: "E.g., Become a Team Lead, Work in AI",
  },
];

const dummyCareers: string[] = [
  "Data Scientist",
  "Frontend Engineer",
  "AI Researcher",
  "Product Manager",
  "UX Designer",
  "Business Analyst",
];

interface SkillInterestData {
  skills: string;
  interests: string;
  goals: string;
}

const typingVariant: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { repeat: Infinity, repeatType: "loop" as const, duration: 1 },
  },
  exit: { opacity: 0 },
};

const messageVariant: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50 },
};

const CareerAgent: React.FC = () => {
  const [step, setStep] = useState(0);
  const [skillInterestData, setSkillInterestData] = useState<SkillInterestData>({
    skills: "",
    interests: "",
    goals: "",
  });
  const [messages, setMessages] = useState<string[]>([
    "Welcome to the Career Pathway Agent! Let's start by assessing your skills and interests.",
  ]);
  const [inputValues, setInputValues] = useState<Partial<SkillInterestData>>({});
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showInsights, setShowInsights] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadedFileInfo, setUploadedFileInfo] = useState<any>(null);

  const { uploadFile, uploading, progress: uploadProgress } = useStorageUpload();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentQuestionId = assessmentQuestions[Object.keys(inputValues).length]?.id;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    setProgress(((step) / (stepTitles.length - 1)) * 100);
  }, [step]);

  const handleInputChange = (field: keyof SkillInterestData, value: string) => {
    setInputValues((prev) => ({ ...prev, [field]: value }));
    setInputValue(value);
  };

  const handleNext = async () => {
    if (step === 0) {
      const allFilled = assessmentQuestions.every((q) => inputValues[q.id as keyof SkillInterestData]?.trim().length! > 0);
      if (!allFilled) return;

      for (const q of assessmentQuestions) {
        setIsTyping(true);
        await new Promise((r) => setTimeout(r, 800));
        setMessages((prev) => [...prev, `${q.label}: ${inputValues[q.id as keyof SkillInterestData]}`]);
        setIsTyping(false);
        await new Promise((r) => setTimeout(r, 200));
      }

      setStep(1);
      setInputValue("");
      setInputValues({});
    } else if (step === 1) {
      if (!resumeFile) return;
      setIsTyping(true);
      setMessages((prev) => [...prev, "Uploading your resume..."]);
      const uploadResult = await uploadFile(resumeFile, "resumes", "");
      setIsTyping(false);
      if (uploadResult) {
        setUploadedFileInfo(uploadResult);
        setMessages((prev) => [...prev, "Resume uploaded successfully!"]);
        setStep(2);
      } else {
        setMessages((prev) => [...prev, "Failed to upload resume. Please try again."]);
      }
      setInputValue("");
    } else if (step === 2) {
      setMessages((prev) => [
        ...prev,
        "Based on your inputs, here are some career recommendations:",
        ...dummyCareers.map((career) => `- ${career}`),
      ]);
      setStep(3);
      setShowInsights(true);
      setInputValue("");
    } else if (step === 3) {
      setMessages((prev) => prev.slice(0, assessmentQuestions.length + dummyCareers.length + 3));
    }
  };

  const handlePrev = () => {
    if (step === 0) return;
    if (step === 1) {
      setStep(0);
      setMessages((prev) => prev.slice(0, assessmentQuestions.length + 1));
    } else if (step === 2) {
      setStep(1);
      setMessages((prev) => prev.slice(0, assessmentQuestions.length + 3));
    } else if (step === 3) {
      setStep(2);
      setShowInsights(false);
      setMessages((prev) => prev.slice(0, assessmentQuestions.length + dummyCareers.length + 3));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((step === 0 && inputValue.trim() && currentQuestionId) || (step === 1 && resumeFile)) {
        handleNext();
      }
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setResumeFile(e.target.files[0]);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl p-6 flex flex-col min-h-screen">
      <h1 className="text-4xl font-bold text-amber-600 mb-4">Career Pathway Agent</h1>
      <p className="mb-6 text-muted-foreground max-w-xl">
        Let’s guide your career step-by-step with personalized recommendations.
      </p>

      <Progress value={progress} className="mb-8" />

      <div className="flex-1 overflow-y-auto space-y-4 max-h-[60vh] mb-8 p-4 border rounded-md bg-slate-50 dark:bg-slate-800">
        <AnimatePresence initial={false} mode="popLayout">
          {messages.map((msg, index) => (
            <motion.div
              key={index}
              variants={messageVariant}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="p-3 rounded-lg bg-amber-50 text-amber-900 max-w-prose break-words shadow-sm"
            >
              {msg}
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              className="p-3 rounded-lg bg-amber-200 text-amber-900 max-w-prose shadow-inner"
              variants={typingVariant}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              Typing...
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </AnimatePresence>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          {assessmentQuestions
            .filter((q) => !inputValues.hasOwnProperty(q.id))
            .slice(0, 1)
            .map((question) => (
              <div key={question.id}>
                <Label htmlFor={question.id}>{question.label}</Label>
                <Textarea
                  id={question.id}
                  placeholder={question.placeholder}
                  value={inputValue}
                  onChange={(e) => handleInputChange(question.id as keyof SkillInterestData, e.target.value)}
                  rows={3}
                  onKeyDown={handleInputKeyDown}
                  className="resize-none"
                  autoFocus
                />
              </div>
            ))}
        </div>
      )}

      {step === 1 && (
        <Card className="p-6 bg-amber-50 shadow-md">
          <CardHeader>
            <CardTitle>Upload Your Resume</CardTitle>
            <CardDescription>
              Please upload your resume document (PDF or DOCX).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input type="file" accept=".pdf,.docx" onChange={onFileChange} />
            {uploading && (
              <Progress value={uploadProgress} className="mt-4" />
            )}
            {uploadedFileInfo && (
              <p className="mt-2 text-sm text-green-800">
                Uploaded: {uploadedFileInfo.fileName}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 bg-amber-50 shadow-md space-y-4">
          <CardHeader>
            <CardTitle>{stepTitles[2]}</CardTitle>
            <CardDescription>Based on your inputs, we recommend these careers:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {dummyCareers.map((career) => (
              <Card key={career} className="bg-amber-100 p-4 shadow rounded-md">
                <CardTitle className="text-amber-700">{career}</CardTitle>
                <CardDescription>
                  This is a recommended career based on your skills and interests.
                </CardDescription>
                <CardFooter>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => alert(`Explore ${career}`)}
                  >
                    Explore Role
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 3 && showInsights && (
        <Card className="p-6 bg-amber-50 shadow-md space-y-4">
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
      )}

      <div className="flex justify-between mt-8 space-x-4">
        <Button
          variant="outline"
          onClick={handlePrev}
          disabled={step === 0 || uploading}
          aria-label="Previous step"
        >
          Previous
        </Button>
        <Button
          onClick={handleNext}
          disabled={
            (step === 0 &&
              !assessmentQuestions.every((q) => inputValues[q.id as keyof SkillInterestData]?.trim().length)
            ) ||
            (step === 1 && !resumeFile) ||
            uploading ||
            step === stepTitles.length -1
          }
          aria-label="Next step"
        >
          {step === stepTitles.length - 2 ? "Show Recommendations" : "Next"}
        </Button>
      </div>
    </div>
  );
};

export default CareerAgent;
