import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, X, ArrowRight, ArrowLeft } from "lucide-react";

interface OnboardingTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

const steps = [
  {
    title: "Welcome to Signage Manager",
    description: "Let's take a quick tour to get you started with managing your signage spots efficiently.",
    icon: "🎯",
  },
  {
    title: "Dashboard Overview",
    description: "Your dashboard shows all signage spots at a glance. Use the status filters to quickly find spots that need attention.",
    icon: "📊",
  },
  {
    title: "Signage Spots",
    description: "Click on any spot to view details, upload photos, and track history. Use multi-select mode for bulk operations.",
    icon: "🖼️",
  },
  {
    title: "Campaigns",
    description: "Organize your signage into campaigns. Link multiple spots to a campaign and track their status together.",
    icon: "📋",
  },
  {
    title: "Settings & Alerts",
    description: "Configure email alerts, manage users, and customize categories and tags to fit your workflow.",
    icon: "⚙️",
  },
];

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    onComplete();
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-glow border-primary/20">
        <CardHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={handleSkip}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="text-4xl mb-4">{steps[currentStep].icon}</div>
          <CardTitle className="text-2xl">{steps[currentStep].title}</CardTitle>
          <CardDescription className="text-base mt-2">
            {steps[currentStep].description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Step {currentStep + 1} of {steps.length}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>
              
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip}>
                  Skip Tour
                </Button>
                <Button onClick={handleNext}>
                  {currentStep < steps.length - 1 ? (
                    <>
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  ) : (
                    <>
                      Get Started
                      <CheckCircle2 className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
