// material-ui
import Divider from '@mui/material/Divider';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project-imports
import Hero from 'sections/landing/Hero';
import ProblemSolution from 'sections/landing/ProblemSolution';
import WhyFitForceWins from 'sections/landing/WhyFitForceWins';
import PricingPlans from 'sections/landing/PricingPlans';
import FinalCTA from 'sections/landing/FinalCTA';
import Subscribe from 'sections/landing/Subscribe';
import SimpleLayout from 'layout/SimpleLayout';

// ==============================|| LANDING PAGE ||============================== //

export default function Landing() {
  return (
    <SimpleLayout>
      <Hero />
      <Box id="problem-solution">
        <ProblemSolution />
      </Box>
      <Box id="why-fitforce">
        <WhyFitForceWins />
      </Box>
      <Box id="pricing">
        <PricingPlans />
      </Box>
      
      {/* Book Demo Section */}
      <Box id="book-demo" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.default' }}>
        <Container>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h2" sx={{ fontWeight: 800, mb: 2 }}>
              Book Your Demo
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              See how FitForce can transform your coaching business. Schedule a personalized demo with our team.
            </Typography>
          </Box>
          
          {/* Calendly iframe */}
          <Box 
            sx={{ 
              height: 800, 
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}
          >
            <iframe
              src="https://zcal.co/i/JprJ400Q"
              width="100%"
              height="100%"
              frameBorder="0"
              title="Book a Demo - FitForce"
              style={{
                border: 'none',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
              scrolling="no"
            />
          </Box>
        </Container>
      </Box>
      
      <FinalCTA />
      <Subscribe />
      <Divider sx={{ borderColor: 'secondary.light' }} />
    </SimpleLayout>
  );
}