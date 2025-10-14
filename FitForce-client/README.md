# 🚀 FitForce Seed - Frontend Application

## 📋 Overview

FitForce Seed is the main frontend application for the FitForce platform - a comprehensive multi-tenant SaaS fitness management system. Built with **Next.js 15**, **React 19**, and **Material-UI**, it provides a professional, accessible, and performant interface for trainers, clients, and administrators.

## 🏗️ Architecture

### **Multi-Tenant Design**
- **Domain-based routing** with automatic workspace detection
- **Three-tier user system**: Trainers, Clients, and Administrators
- **Workspace isolation** with complete data separation
- **Custom branding** and subdomain support

### **Technology Stack**
- **Framework**: Next.js 15.5.2 with App Router
- **React**: 19.1.1 (Latest version)
- **UI Library**: Material-UI 7.3.2
- **State Management**: Redux Toolkit + React Redux
- **Authentication**: NextAuth.js 4.24.11
- **HTTP Client**: Axios with interceptors
- **Real-time**: Socket.IO Client
- **Data Fetching**: SWR for client-side data fetching
- **Forms**: Formik + Yup validation
- **Styling**: Emotion (CSS-in-JS)
- **Testing**: Jest + React Testing Library

## 🎯 User Interfaces

### **1. Trainer Dashboard (`/dashboard/*`)**
Comprehensive fitness business management interface featuring:
- **Client Management**: Full CRUD operations, progress tracking
- **Nutrition Planning**: Advanced meal planning and templates
- **Workout Planning**: Exercise library, workout templates
- **Forms System**: Custom form builder and client intake
- **Finance Management**: Subscription tracking, revenue analytics
- **Messaging System**: Real-time client communication
- **Workspace Settings**: Branding, templates, PDF generation

### **2. Client Portal (`/client/*`)**
Self-service client interface with:
- **Personal Dashboard**: Progress overview and metrics
- **Plan Access**: View nutrition and workout plans
- **Form Submissions**: Complete intake and progress forms
- **Subscription Management**: View and renew subscriptions
- **Support System**: Direct trainer communication
- **Payment Processing**: Secure payment handling

### **3. Admin Panel (`/admin/*`)**
Platform administration interface including:
- **Workspace Management**: Platform-wide workspace oversight
- **Package Management**: Subscription package creation
- **Analytics & Reporting**: Business intelligence dashboard
- **Content Management**: Global food items and exercises
- **Monitoring Dashboard**: System health and performance
- **Free Trial Management**: Growth and onboarding tools

## 🔧 Development Setup

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Git

### **Installation**
```bash
# Clone the repository
git clone <repository-url>
cd fitForce-v3/seed

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev
```

### **Environment Variables**
```env
# API Configuration
NEXT_PUBLIC_API_URL=https://api.nano.com
NEXT_PUBLIC_FRONTEND_DOMAIN=fitforceapp.com
NEXT_PUBLIC_MAIN_DOMAIN=https://fitforceapp.com
NEXT_PUBLIC_MANAGEMENT_SUBDOMAIN=admin

# Authentication
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000

# Optional
NEXT_PUBLIC_FEATURED_WORKSPACE_ID=workspace-id
NEXT_PUBLIC_DEFAULT_THEME=light
NEXT_PUBLIC_DEFAULT_LANG=en
```

## 🚀 Available Scripts

### **Development**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
```

### **Code Quality**
```bash
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run prettier     # Format code with Prettier
```

### **Testing**
```bash
npm run test         # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
npm run test:ci      # Run tests for CI/CD
```

## 🧪 Testing

### **Test Structure**
```
src/
├── components/
│   ├── __tests__/
│   │   ├── ErrorBoundary.test.tsx
│   │   ├── AccessibilityProvider.test.tsx
│   │   └── ...
│   └── ...
├── utils/
│   ├── __tests__/
│   └── ...
└── ...
```

### **Running Tests**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test ErrorBoundary.test.tsx
```

### **Test Coverage**
- **Target**: 70% coverage across all metrics
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

## ♿ Accessibility Features

### **Built-in Accessibility**
- **Screen Reader Support**: ARIA labels and live regions
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast Mode**: Enhanced color contrast
- **Reduced Motion**: Respects user motion preferences
- **Font Scaling**: Adjustable font sizes
- **Focus Indicators**: Clear focus outlines
- **Color Blind Support**: Additional visual indicators

### **Accessibility Controls**
- **Floating Controls**: Always-accessible settings panel
- **Skip Links**: Skip to main content
- **Screen Reader Announcements**: Live updates
- **Keyboard Shortcuts**: Power user features

### **WCAG Compliance**
- **Level AA**: Meets WCAG 2.1 AA standards
- **Semantic HTML**: Proper HTML structure
- **ARIA Support**: Comprehensive ARIA implementation
- **Color Contrast**: Meets contrast requirements

## 📊 Performance Monitoring

### **Core Web Vitals**
- **First Contentful Paint (FCP)**: < 1.8s
- **Largest Contentful Paint (LCP)**: < 2.5s
- **First Input Delay (FID)**: < 100ms
- **Cumulative Layout Shift (CLS)**: < 0.1

### **Performance Features**
- **Real-time Monitoring**: Live performance tracking
- **User Interaction Tracking**: Click and scroll latency
- **Memory Usage**: JavaScript heap monitoring
- **Resource Loading**: Asset load time tracking
- **Automatic Reporting**: Performance data collection

## 🔒 Security Features

### **Authentication & Authorization**
- **Multi-Authentication**: Separate systems for different user types
- **JWT Tokens**: Secure token-based authentication
- **Route Guards**: Protected route access
- **Session Management**: Secure session handling
- **CSRF Protection**: Cross-site request forgery prevention

### **Data Protection**
- **Input Validation**: Comprehensive form validation
- **XSS Prevention**: Cross-site scripting protection
- **Content Security Policy**: CSP headers
- **Secure Headers**: Security-focused HTTP headers

## 🎨 UI/UX Features

### **Design System**
- **Material Design 3**: Modern, accessible design language
- **Responsive Design**: Mobile-first, fully responsive
- **Dark/Light Themes**: Complete theme system
- **RTL Support**: Right-to-left language support
- **Customization**: Workspace branding and theming

### **User Experience**
- **Intuitive Navigation**: Clear information architecture
- **Progressive Disclosure**: Complex features revealed gradually
- **Real-time Updates**: Live data synchronization
- **Error Handling**: Graceful error states and recovery
- **Loading States**: Proper loading and skeleton states

## 🔧 Error Handling

### **Error Boundary System**
- **Global Error Boundaries**: Catch and handle React errors
- **Component-Level Boundaries**: Granular error handling
- **Error Reporting**: Automatic error logging
- **User-Friendly Messages**: Clear error communication
- **Recovery Options**: Retry and reload functionality

### **Error Types**
- **JavaScript Errors**: Runtime errors and exceptions
- **Network Errors**: API and connectivity issues
- **Validation Errors**: Form and input validation
- **Authentication Errors**: Login and authorization issues

## 📱 Mobile Support

### **Responsive Design**
- **Mobile-First**: Optimized for mobile devices
- **Touch-Friendly**: Large touch targets
- **Gesture Support**: Swipe and pinch gestures
- **Offline Support**: Service worker integration
- **PWA Ready**: Progressive web app capabilities

## 🚀 Deployment

### **Build Process**
```bash
# Build for production
npm run build

# Start production server
npm run start
```

### **Environment Configuration**
- **Development**: `npm run dev`
- **Staging**: Build with staging environment variables
- **Production**: Build with production environment variables

### **Docker Support**
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 📚 Documentation

### **Code Documentation**
- **TypeScript**: Full type definitions
- **JSDoc**: Function and component documentation
- **README Files**: Component and feature documentation
- **API Documentation**: Endpoint and integration docs

### **User Documentation**
- **User Guides**: Step-by-step instructions
- **Feature Documentation**: Comprehensive feature explanations
- **Troubleshooting**: Common issues and solutions
- **FAQ**: Frequently asked questions

## 🤝 Contributing

### **Development Workflow**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

### **Code Standards**
- **TypeScript**: Strict type checking
- **ESLint**: Code linting and style
- **Prettier**: Code formatting
- **Testing**: Comprehensive test coverage
- **Documentation**: Clear code documentation

## 📊 Project Status

### **Current Version**: 4.1.0
### **Last Updated**: January 2025
### **Maintainer**: PhoenixCoded

## 🎯 Roadmap

### **Upcoming Features**
- [ ] PWA enhancements
- [ ] Advanced analytics
- [ ] AI-powered recommendations
- [ ] Mobile app integration
- [ ] Enhanced offline support

### **Performance Improvements**
- [ ] Bundle optimization
- [ ] Image optimization
- [ ] Caching strategies
- [ ] CDN integration

## 📞 Support

### **Getting Help**
- **Documentation**: Check this README and component docs
- **Issues**: Report bugs and feature requests
- **Discussions**: Community discussions and Q&A
- **Email**: PhoenixCoded@gmail.com

### **Reporting Issues**
When reporting issues, please include:
- **Environment**: Node.js version, OS, browser
- **Steps to Reproduce**: Clear reproduction steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: Visual evidence if applicable

## 📄 License

This project is private and proprietary. All rights reserved.

---

**Built with ❤️ by PhoenixCoded**

*FitForce - Empowering fitness professionals worldwide*

