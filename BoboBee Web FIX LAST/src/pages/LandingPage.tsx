import {
  ArrowRight,
  Baby,
  Heart,
  Moon,
  Shield,
  Users,
  Wifi
} from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-amber-50">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Baby className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-400 rounded-full animate-pulse"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                BoBoBee
              </h1>
              <p className="text-xs text-amber-600">Smart Sleep Guardian</p>
            </div>
          </div>
          <Link to="/login">
            <Button className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white shadow-lg">
              Sign In
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              Smart Care,{' '}
              <span className="bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent">
                Sweet Dream
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              BoBoBee is your intelligent sleep companion that monitors your toddler's sleep position, 
              environment, and comfort in real-time, ensuring peaceful nights for the whole family.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/login">
              <Button size="lg" className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white shadow-xl px-12 py-4 text-lg font-semibold transition-all duration-300 transform hover:scale-105">
                Start Monitoring
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Hero Image Placeholder */}
          <div className="relative max-w-3xl mx-auto">
            <div className="bg-gradient-to-br from-yellow-100 to-amber-100 rounded-3xl p-8 shadow-2xl">
              <div className="aspect-video bg-white rounded-2xl shadow-inner flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Baby className="h-12 w-12 text-white" />
                  </div>
                  <p className="text-gray-600">Live Camera Feed Preview</p>
                </div>
              </div>
            </div>
            {/* Floating Elements */}
            <div className="absolute -top-4 -left-4 w-8 h-8 bg-yellow-400 rounded-lg rotate-12 animate-bounce"></div>
            <div className="absolute -top-2 -right-6 w-6 h-6 bg-orange-400 rounded-full animate-pulse"></div>
            <div className="absolute -bottom-4 -right-4 w-10 h-10 bg-amber-400 rounded-xl rotate-45 animate-bounce delay-300"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Why Parents Choose BoBoBee
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Advanced monitoring technology designed specifically for toddler sleep safety and comfort
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="Sleep Position Monitoring"
            description="AI-powered detection ensures your baby sleeps in safe positions with instant alerts for prone positioning."
            color="from-green-400 to-emerald-500"
          />
          <FeatureCard
            icon={<Heart className="h-8 w-8" />}
            title="Cry Detection & Response"
            description="Advanced audio analysis detects different cry patterns and can automatically play soothing sounds."
            color="from-pink-400 to-rose-500"
          />
          <FeatureCard
            icon={<Wifi className="h-8 w-8" />}
            title="Real-time Monitoring"
            description="24/7 live streaming and instant notifications keep you connected wherever you are."
            color="from-blue-400 to-cyan-500"
          />
          <FeatureCard
            icon={<Moon className="h-8 w-8" />}
            title="Environment Control"
            description="Monitor temperature and humidity to maintain the perfect sleep environment for your little one."
            color="from-purple-400 to-violet-500"
          />
          <FeatureCard
            icon={<Baby className="h-8 w-8" />}
            title="Sleep Training Support"
            description="Gentle guidance and insights to help establish healthy sleep patterns and routines."
            color="from-yellow-400 to-amber-500"
          />
          <FeatureCard
            icon={<Users className="h-8 w-8" />}
            title="Family Sharing"
            description="Multiple caregivers can monitor and receive alerts, keeping everyone in the loop."
            color="from-indigo-400 to-blue-500"
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-500 border-0 shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-black/10"></div>
          <CardContent className="relative p-8 md:p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to Transform Sleep Time?
            </h2>
            <p className="text-lg md:text-xl text-yellow-50 mb-8 max-w-2xl mx-auto leading-relaxed">
              Join thousands of parents who trust BoBoBee to keep their little ones safe and sound.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" className="bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-white shadow-xl px-12 py-4 text-lg font-semibold transition-all duration-300 transform hover:scale-105">
                Join With Us !
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            </div>
          </CardContent>
        </Card>
      </section>


      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center">
                <Baby className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold">BoBoBee</h3>
                <p className="text-sm text-gray-400">Smart Sleep Guardian</p>
              </div>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400">© 2025 BoBoBee. All rights reserved.</p>
              <p className="text-sm text-gray-500">Keeping families safe, one sleep at a time.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  return (
    <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg">
      <CardContent className="p-8 text-center">
        <div className={`w-16 h-16 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
        <p className="text-gray-600 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

