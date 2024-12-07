"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAppKitProvider, useAppKitAccount } from "@reown/appkit/react";
import { Wallet, Trophy, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from "react-hot-toast";
import { ethers } from "ethers";

import { questions } from "./questions";

if (!process.env.NEXT_PUBLIC_SERVICE_ID) throw new Error("process.env.NEXT_PUBLIC_SERVICE_ID is not defined");

export default function CryptoQuizGame() {
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<boolean[]>(
    new Array(questions.length).fill(false)
  );
  const { address, isConnected } = useAppKitAccount();

  useEffect(() => {
    if (isConnected && step === 0) {
      setStep(1);
    }
  }, [isConnected]);

  const handleAnswer = () => {
    if (selectedAnswer === null) return;

    const correct = selectedAnswer === questions[step - 1].correctAnswer;
    setIsCorrect(correct);
    if (correct) setScore(score + 1);

    const newAnsweredQuestions = [...answeredQuestions];
    newAnsweredQuestions[step - 1] = true;
    setAnsweredQuestions(newAnsweredQuestions);

    setTimeout(() => {
      setSelectedAnswer(null);
      setIsCorrect(null);
      if (step < questions.length) {
        setStep(step + 1);
      } else if (newAnsweredQuestions.every(Boolean)) {
        setStep(questions.length + 1);
        handleQuizComplete();
      }
    }, 1000);
  };

  const resetQuiz = () => {
    setStep(1);
    setScore(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setAnsweredQuestions(new Array(questions.length).fill(false));
  };

  const handleQuizComplete = async () => {
    toast.success("Quiz completed! Great job!");
    try {
      const attestInteractionPromise =  toast.promise(
        signMessage(),
        {
          loading: "Processing your interaction...",
          success: "Kindly check your MailChain email for a confirmation message!",
          error: "An error occurred while processing your interaction",
        },
      );

      await attestInteractionPromise;
      
      window.open(
        "https://app.mailchain.com/inbox",
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while processing your interaction");
    }
  };

  async function signMessage() {
    try {
      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await ethersProvider.getSigner();
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `Completing quiz interaction at timestamp: ${timestamp}`;
      const signature = await signer.signMessage(message);
  
      console.log(address);
      const response = await fetch("/api/interaction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userAddress: address,
          signature,
          timestamp,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to send invitation");
      }
  
      const data = await response.json();
      return data.message;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500">
      <header className="bg-black text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Crypto Quiz</h1>
          <div className="flex items-center space-x-2">
            {isConnected && <w3m-account-button size="sm" />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 flex flex-col items-center justify-center">
        <Card className="w-full max-w-[400px] overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
            <CardTitle className="text-2xl font-bold">Crypto Quiz</CardTitle>
            <CardDescription className="text-blue-100">
              Test your blockchain knowledge
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="connect"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-center space-y-4"
                >
                  <Wallet className="w-16 h-16 mx-auto text-blue-500" />
                  <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
                  <p className="text-gray-600">
                    Please connect your wallet to start the quiz.
                  </p>
                  <div className="flex justify-center">
                    <w3m-button size="md" />
                  </div>
                </motion.div>
              )}
              {step > 0 && step <= questions.length && (
                <motion.div
                  key={`question-${step}`}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="space-y-4">
                    <Progress
                      value={(step / questions.length) * 100}
                      className="w-full"
                    />
                    <h2 className="text-xl font-semibold">
                      {questions[step - 1].question}
                    </h2>
                    <RadioGroup
                      value={selectedAnswer?.toString()}
                      onValueChange={(value) =>
                        setSelectedAnswer(parseInt(value))
                      }
                    >
                      {questions[step - 1].options.map((option, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-2"
                        >
                          <RadioGroupItem
                            value={index.toString()}
                            id={`option-${index}`}
                          />
                          <Label htmlFor={`option-${index}`}>{option}</Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </motion.div>
              )}
              {step === questions.length + 1 && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center space-y-4">
                    <Trophy className="w-16 h-16 mx-auto text-yellow-500" />
                    <h2 className="text-2xl font-bold">Quiz Completed!</h2>
                    <p className="text-xl">
                      Your Score: {score} / {questions.length}
                    </p>
                    <p className="text-gray-600">
                      {score === questions.length
                        ? "Perfect score! You're a crypto expert!"
                        : score >= questions.length / 2
                        ? "Great job! You know your stuff."
                        : "Keep learning! The crypto world is vast."}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
          <CardFooter className="bg-gray-50">
            {step > 0 && step <= questions.length && (
              <Button
                onClick={handleAnswer}
                disabled={selectedAnswer === null}
                className="w-full"
              >
                {isCorrect === null
                  ? "Submit Answer"
                  : isCorrect
                  ? "Correct!"
                  : "Incorrect"}
              </Button>
            )}
            {step === questions.length + 1 && (
              <Button onClick={resetQuiz} className="w-full">
                Play Again
              </Button>
            )}
          </CardFooter>
        </Card>
      </main>

      {isCorrect !== null && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className={`fixed bottom-4 right-4 p-4 rounded-lg text-white ${
            isCorrect ? "bg-green-500" : "bg-red-500"
          }`}
        >
          <div className="flex items-center space-x-2">
            {isCorrect ? (
              <Trophy className="w-6 h-6" />
            ) : (
              <AlertCircle className="w-6 h-6" />
            )}
            <span>{isCorrect ? "Correct!" : "Incorrect"}</span>
          </div>
        </motion.div>
      )}
      <div className="fixed top-20 right-4 flex space-x-2">
        {answeredQuestions.map((answered, index) => (
          <motion.div
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: answered ? 1 : 0 }}
            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
          >
            <CheckCircle2 className="w-6 h-6 text-white" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
