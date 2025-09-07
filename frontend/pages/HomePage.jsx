import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowRight,
  Zap,
  Type,
  Scaling,
  Bot,
  UploadCloud,
  Sparkles,
  Download,
} from "lucide-react";
import ctaLogo from "../assets/id-export-logo.png";
import idLogo from "../assets/id-logo.png"; // Import your logo
import { motion } from "framer-motion";

const fadeInVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" } },
};

const FadeInSection = ({ children }) => {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      ref={ref}
      variants={fadeInVariants}
      initial="hidden"
      animate={isVisible ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  );
};

const Navbar = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex-shrink-0">
            <a href="/" className="flex items-center gap-2">
              {/* Replaced Bird icon with img tag for your logo */}
              <img src={idLogo} alt="InsightDuck Logo" className="h-8 w-auto" />
              <span className="text-xl font-bold text-white">InsightDuck</span>
            </a>
          </div>
          <nav className="hidden md:flex md:items-center md:space-x-8">
            <a
              href="#features"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              How It Works
            </a>
            <a
              href="#use-cases"
              className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Use Cases
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <a
              href="/auth"
              className="hidden sm:inline-block text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              Sign In
            </a>
            <a
              href="/auth"
              className="inline-flex items-center justify-center rounded-md bg-[#F5D742] px-4 py-2 text-sm font-semibold text-[#1E1C1C] shadow-sm transition-colors hover:bg-[#E0C53B] focus:outline-none focus:ring-2 focus:ring-[#F5D742] focus:ring-offset-2 focus:ring-offset-[#1E1C1C]"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </header>
  );
};

const HeroSection = () => {
  return (
    <FadeInSection>
    <div className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#F5D742]/10 to-[#1E1C1C]"></div>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10 sm:pt-32 sm:pb-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
          Clean, Profile, and Understand Your Data Instantly
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-300 max-w-2xl mx-auto">
          InsightDuck is an intelligent, AI-powered agent that automates the
          tedious process of data cleaning and exploratory data analysis. Upload
          your CSV and get actionable insights in minutes.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <a
            href="/auth"
            className="inline-flex items-center gap-x-2 rounded-md bg-[#F5D742] px-6 py-3 text-lg font-semibold text-[#1E1C1C] shadow-lg transition-colors hover:bg-[#E0C53B] focus:outline-none focus:ring-2 focus:ring-[#F5D742] focus:ring-offset-2 focus:ring-offset-[#1E1C1C]"
          >
            Get Started for Free
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </div>
    </div>
    </FadeInSection>
  );
};

const features = [
  {
    title: "Automated Cleaning",
    icon: Bot,
    description:
      "Instantly handle common data issues. From standardizing column names and trimming whitespace to unifying null values, our AI gets your data ready for analysis in seconds.",
    imageUrl: "../assets/Homepage-feature-1.png",
  },
  {
    title: "Impute Null Data",
    icon: Zap,
    description:
      "Handle missing data intelligently. InsightDuck can fill empty (NULL) values using various strategies like mean, median, or mode, ensuring your dataset is complete and ready for analysis.",
    imageUrl: "../assets/Homepage-feature-4.jpg",
  },
  {
    title: "Data Type Conversions",
    icon: Type,
    description:
      "Apply suggested type conversions with a single click. Our safe conversion process prevents data loss by flagging values that couldn't be converted, giving you full control.",
    imageUrl: "../assets/Homepage-feature-3.png",
  },
  {
    title: "Exploratory Data Analysis",
    icon: Scaling,
    description:
      "Coming soon! Unlock deeper insights with automated EDA. Visualize distributions, identify correlations, and understand your dataset's story without writing a single line of code.",
    imageUrl: "../assets/Homepage-feature-5.png",
  },
];

const FeaturesSection = () => {
  const [activeFeature, setActiveFeature] = useState(0);
  const [progressKey, setProgressKey] = useState(0);

  const handleFeatureSelect = useCallback((index) => {
    setActiveFeature(index);
    setProgressKey((prev) => prev + 1);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
      setProgressKey((prev) => prev + 1);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const animationStyle = `
    @keyframes progress-bar {
      from { width: 0%; }
      to { width: 100%; }
    }
    .animate-progress {
      animation: progress-bar 5s linear forwards;
    }
  `;

  return (
    <FadeInSection>
    <section id="features" className="py-16 sm:py-16 bg-[#1E1C1C]">
      <style>{animationStyle}</style>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            A Smarter, Faster Workflow
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            InsightDuck automates the most time-consuming parts of data
            preparation, so you can focus on what matters.
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex flex-row gap-8 lg:gap-12">
          <div className="w-full md:w-1/3 flex flex-col space-y-4">
            {features.map((feature, index) => (
              <button
                key={index}
                onClick={() => handleFeatureSelect(index)}
                className={`w-full text-left p-4 rounded-lg transition-all duration-300 relative overflow-hidden ${
                  activeFeature === index
                    ? "bg-[#2A2828] scale-105 shadow-2xl"
                    : "bg-transparent hover:bg-[#2A2828]/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <feature.icon
                    className={`h-8 w-8 transition-colors ${
                      activeFeature === index
                        ? "text-[#F5D742]"
                        : "text-gray-400"
                    }`}
                  />
                  <div>
                    <h3
                      className={`text-lg font-semibold ${
                        activeFeature === index ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {feature.title}
                    </h3>
                  </div>
                </div>
                {activeFeature === index && (
                  <div className="absolute bottom-0 left-0 h-1 bg-[#3F3F3F] w-full mt-2">
                    <div
                      key={progressKey}
                      className="h-1 bg-[#F5D742] animate-progress"
                    ></div>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="w-full md:w-2/3 min-h-[400px]">
            <div className="relative w-full h-full bg-[#2A2828] rounded-2xl shadow-lg overflow-hidden">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                    activeFeature === index
                      ? "opacity-100 z-10"
                      : "opacity-0 z-0"
                  }`}
                >
                  <img
                    src={feature.imageUrl}
                    alt={feature.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 p-8">
                    <p className="text-white text-xl">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          {/* Feature Navigation Dots */}
          <div className="flex justify-center gap-2 mb-6">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => handleFeatureSelect(index)}
                className={`w-3 h-3 rounded-full transition-colors ${
                  activeFeature === index ? "bg-[#F5D742]" : "bg-gray-600"
                }`}
                aria-label={`Feature ${index + 1}`}
              />
            ))}
          </div>

          {/* Mobile Feature Card */}
          <div className="relative bg-[#2A2828] rounded-2xl shadow-lg overflow-hidden">
            {/* Feature Header */}
            <div className="p-6 bg-[#1E1C1C] border-b border-[#3F3F3F]">
              <div className="flex items-center gap-4 mb-4">
                {React.createElement(features[activeFeature].icon, {
                  className: "h-8 w-8 text-[#F5D742]",
                })}
                <h3 className="text-xl font-semibold text-white">
                  {features[activeFeature].title}
                </h3>
              </div>
              <p className="text-gray-300 text-base leading-relaxed">
                {features[activeFeature].description}
              </p>
            </div>

            {/* Feature Image */}
            <div className="relative h-64 overflow-hidden">
              <img
                src={features[activeFeature].imageUrl}
                alt={features[activeFeature].title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent"></div>
            </div>

            {/* Progress Bar */}
            <div className="absolute bottom-0 left-0 h-1 bg-[#3F3F3F] w-full">
              <div
                key={progressKey}
                className="h-1 bg-[#F5D742] animate-progress"
              ></div>
            </div>
          </div>

          {/* Swipe Indicator */}
          <div className="text-center mt-4">
            <p className="text-sm text-gray-500">
              Swipe or tap dots to explore features
            </p>
          </div>
        </div>
      </div>
    </section>
    </FadeInSection>
  );
};

const useCases = [
  {
    emoji: "🎓",
    text: "Quickly clean Kaggle datasets for ML projects.",
    className: "lg:col-span-2",
  },
  { emoji: "📊", text: "Generate graphs instantly for assignments." },
  { emoji: "🧑‍💻", text: "Save time prepping data for models." },
  {
    emoji: "💡",
    text: "Focus on learning, not fixing CSV errors.",
    className: "lg:col-span-2",
  },
];

const UseCasesSection = () => {
  return (
    <FadeInSection>
    <section id="use-cases" className="py-16 sm:py-16 bg-[#1E1C1C]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built for students, loved by learners
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => (
            <div
              key={index}
              className={`bg-[#2A2828] p-8 rounded-2xl border border-[#3F3F3F] flex flex-col justify-center items-center text-center transform hover:-translate-y-2 transition-transform duration-300 ${
                useCase.className || ""
              }`}
            >
              <span className="text-5xl mb-4">{useCase.emoji}</span>
              <p className="text-gray-300 text-lg">{useCase.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
    </FadeInSection>
  );
};

const HowItWorksSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  const steps = [
    {
      icon: UploadCloud,
      title: "Upload Your Data",
      description:
        "Drag and drop any CSV file or connect directly to a Kaggle dataset. No complex setup required.",
    },
    {
      icon: Sparkles,
      title: "Automated Cleaning & EDA",
      description:
        "Our AI agent analyzes your data, performs cleaning operations, and prepares an initial analysis.",
    },
    {
      icon: Download,
      title: "Explore or Export",
      description:
        "Interact with your clean data in the dashboard or download the ready-to-use file for your projects.",
    },
  ];

  const animationStyle = `
    @keyframes move-line-horizontal {
      from { transform: translateX(-110%); }
      to { transform: translateX(410%); }
    }
    @keyframes move-line-vertical {
      from { transform: translateY(-110%); }
      to { transform: translateY(410%); }
    }
    .animate-line-horizontal {
      animation: move-line-horizontal 3s ease-in-out infinite;
    }
    .animate-line-vertical {
       animation: move-line-vertical 3s ease-in-out infinite;
    }
  `;

  return (
    <FadeInSection>
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-12 sm:py-24 bg-gradient-to-b from-[#1E1C1C] to-[#2A2828]"
    >
      <style>{animationStyle}</style>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            From Messy CSV to Insights in 3 Steps
          </h2>
        </div>

        <div className="relative">
          <div
            className="hidden lg:block absolute top-12 left-0 w-full h-0.5 bg-repeat-x bg-center"
            style={{
              backgroundImage:
                "radial-gradient(circle at center, #3F3F3F 1px, transparent 1px)",
              backgroundSize: "16px 1px",
            }}
          >
            <div className="h-full w-full overflow-hidden relative">
              {isVisible && (
                <div className="absolute top-0 left-0 h-full w-1/4 bg-[#F5D742] animate-line-horizontal" />
              )}
            </div>
          </div>

          <div
            className="absolute top-0 left-12 w-0.5 h-full lg:hidden bg-repeat-y bg-center"
            style={{
              backgroundImage:
                "radial-gradient(circle at center, #3F3F3F 1px, transparent 1px)",
              backgroundSize: "1px 16px",
            }}
          >
            <div className="h-full w-full overflow-hidden relative">
              {isVisible && (
                <div className="absolute top-0 left-0 w-full h-1/4 bg-[#F5D742] animate-line-vertical" />
              )}
            </div>
          </div>

          <div className="relative flex flex-col lg:flex-row justify-between items-start lg:items-center gap-12 lg:gap-8">
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-start lg:flex-col lg:items-center lg:text-center w-full lg:w-1/3 z-10"
              >
                <div className="flex-shrink-0 mb-0 lg:mb-6 mr-6 lg:mr-0">
                  <div className="w-24 h-24 bg-[#1E1C1C] border-2 border-[#3F3F3F] rounded-full flex items-center justify-center">
                    <step.icon className="w-12 h-12 text-[#F5D742]" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-400">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
    </FadeInSection>
  );
};

const CTASection = () => {
  return (
    <FadeInSection>
    <section className="py-16 sm:py-16 bg-[#2A2828]">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1E1C1C] border-2 border-[#3F3F3F] rounded-3xl p-8 md:pl-12 relative">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="md:w-2/3 text-center md:text-left relative z-10">
              <h2 className="font-mono text-3xl sm:text-4xl tracking-tight text-white">
                Stop wasting time cleaning data.
                <br />
                Start building models.
              </h2>
              <div className="mt-8">
                <a
                  href="/auth"
                  className="inline-flex items-center justify-center rounded-md border-2 border-[#F5D742] bg-transparent px-8 py-3 text-base font-semibold text-[#F5D742] shadow-sm transition-colors hover:bg-[#F5D742] hover:text-[#1E1C1C]"
                >
                  Try it now
                </a>
              </div>
            </div>
            <div className="w-full md:w-1/3 flex justify-center md:justify-end">
              <img
                src={ctaLogo}
                alt="InsightDuck giving a thumbs up"
                className="w-48 md:w-136 h-auto md:absolute md:-top-24 md:right-15"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
    </FadeInSection>
  );
};

const Footer = () => {
  return (
    <FadeInSection>
    <footer className="bg-[#1E1C1C] border-t border-[#3F3F3F] overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <img src={idLogo} alt="InsightDuck Logo" className="h-6 w-auto" />
            <span className="text-lg font-bold text-white">InsightDuck</span>
          </div>
          <p className="text-sm text-gray-400 mt-4 md:mt-0">
            &copy; {new Date().getFullYear()} InsightDuck. All rights reserved.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          Created with <span className="text-red-500">&hearts;</span> by{" "}
          <a
            href="https://apoorav-malik.netlify.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-[#F5D742] transition-colors"
          >
            Apoorav Malik
          </a>
        </p>
      </div>
    </footer>
    </FadeInSection>
  );
};

const HomePage = () => {
  return (
    <div className="bg-[#1E1C1C]">
      <Navbar />
      <main className="min-h-screen">
        <HeroSection />
        <FeaturesSection />
        <UseCasesSection />
        <HowItWorksSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
