'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Stack,
  Typography,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Box,
  Alert,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Autocomplete,
  Select,
  MenuItem,
} from '@mui/material';
import { createFilterOptions } from '@mui/material/Autocomplete';
import { CheckCircle } from '@mui/icons-material';
import { useAppSelector } from '@/store';
import api from '@/utils/axios';

// Common country codes
const COUNTRY_CODES = [
  { code: '+1', name: 'US/CA', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: '+212', name: 'Morocco', flag: '🇲🇦' },
  { code: '+213', name: 'Algeria', flag: '🇩🇿' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+90', name: 'Turkey', flag: '🇹🇷' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: '+961', name: 'Lebanon', flag: '🇱🇧' },
  { code: '+962', name: 'Jordan', flag: '🇯🇴' },
  { code: '+964', name: 'Iraq', flag: '🇮🇶' },
  { code: '+965', name: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', name: 'Bahrain', flag: '🇧🇭' },
  { code: '+974', name: 'Qatar', flag: '🇶🇦' },
  { code: '+968', name: 'Oman', flag: '🇴🇲' },
  { code: '+972', name: 'Israel', flag: '🇮🇱' },
];

interface Package {
  id: string;
  name: string;
  description?: string;
  durationMonths: number;
  priceCents: number;
  currency: string;
}

interface FormTemplate {
  id: string;
  title: string;
  type: string;
}

interface CreateClientWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const steps = ['Client Details', 'Subscription', 'Forms', 'Complete'];

const filterCountryOptions = createFilterOptions({
  matchFrom: 'any',
  stringify: (option: typeof COUNTRY_CODES[number]) =>
    `${option.name} ${option.code} ${option.flag}`.toLowerCase(),
});

export default function CreateClientWizard({ open, onClose, onSuccess }: CreateClientWizardProps) {
  const workspaceId = useAppSelector((s) => s.workspace.id);
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Client Details
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+1'); // Default to US
  const [password, setPassword] = useState('');
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);

  // Step 2: Subscription
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [assignSubscription, setAssignSubscription] = useState(true);

  // Step 3: Forms
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [selectedWorkoutFormId, setSelectedWorkoutFormId] = useState<string>('');
  const [selectedNutritionFormId, setSelectedNutritionFormId] = useState<string>('');
  const [assignForms, setAssignForms] = useState(true);

  // Validation states
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [isValidatingPhone, setIsValidatingPhone] = useState(false);

  useEffect(() => {
    if (open) {
      loadPackagesAndForms();
    }
  }, [open]);

  const loadPackagesAndForms = async () => {
    try {
      if (!workspaceId) return;
      
      // Load packages
      const packagesRes = await api.get(`/api/workspaces/${workspaceId}/client-packages`);
      setPackages(packagesRes.data.packages || []);

      // Load form templates
      const formsRes = await api.get('/api/forms/templates');
      setFormTemplates(formsRes.data.templates || []);
    } catch (err) {
      console.error('Error loading packages and forms:', err);
    }
  };

  // Validation functions
  const validateEmail = async (emailValue: string) => {
    if (!emailValue || !emailValue.includes('@')) {
      setEmailError(null);
      return;
    }

    setIsValidatingEmail(true);
    try {
      const res = await api.get('/api/clients');
      const clients = res.data.clients || [];
      const existingClient = clients.find((client: any) => 
        client.email && client.email.toLowerCase() === emailValue.toLowerCase()
      );
      
      if (existingClient) {
        setEmailError('A client with this email already exists in this workspace');
      } else {
        setEmailError(null);
      }
    } catch (err) {
      console.error('Error validating email:', err);
      setEmailError(null);
    } finally {
      setIsValidatingEmail(false);
    }
  };

  const validatePhone = async (phoneValue: string) => {
    if (!phoneValue || phoneValue.trim().length === 0) {
      setPhoneError(null);
      return;
    }

    // Basic phone number validation - should be digits only, 7-15 digits
    const phoneDigits = phoneValue.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      setPhoneError('Phone number must be between 7 and 15 digits');
      return;
    }

    setIsValidatingPhone(true);
    try {
      const res = await api.get('/api/clients');
      const clients = res.data.clients || [];
      const fullPhone = phoneCountryCode + phoneDigits;
      const existingClient = clients.find((client: any) => 
        client.phone && client.phone === fullPhone
      );
      
      if (existingClient) {
        setPhoneError('A client with this phone number already exists in this workspace');
      } else {
        setPhoneError(null);
      }
    } catch (err) {
      console.error('Error validating phone:', err);
      setPhoneError(null);
    } finally {
      setIsValidatingPhone(false);
    }
  };

  const validatePassword = (passwordValue: string) => {
    if (!passwordValue || passwordValue.trim().length === 0) {
      setPasswordError('Password is required');
      return;
    }

    if (passwordValue.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError(null);
    }
  };

  const handleNext = async () => {
    if (activeStep === 0) {
      // Check for validation errors before proceeding
      if (emailError || phoneError || passwordError) {
        setError('Please fix the validation errors before proceeding');
        return;
      }
      
      // Create client
      await createClient();
    } else if (activeStep === 1) {
      // Assign subscription if selected
      if (assignSubscription && selectedPackageId && createdClientId) {
        await assignSubscriptionToClient();
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      // Assign forms if selected
      if (assignForms && createdClientId) {
        await assignFormsToClient();
      }
      setActiveStep(3);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleComplete = () => {
    handleReset();
    onSuccess();
    onClose();
  };

  const handleReset = () => {
    setActiveStep(0);
    setFullName('');
    setEmail('');
    setPhone('');
    setPhoneCountryCode('+1');
    setPassword('');
    setCreatedClientId(null);
    setSelectedPackageId('');
    setSelectedWorkoutFormId('');
    setSelectedNutritionFormId('');
    setAssignSubscription(true);
    setAssignForms(true);
    setError(null);
    setEmailError(null);
    setPhoneError(null);
    setPasswordError(null);
  };

  const createClient = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!fullName.trim()) {
        setError('Full name is required');
        setLoading(false);
        return;
      }

      if (!email.trim()) {
        setError('Email is required');
        setLoading(false);
        return;
      }

      if (!password.trim()) {
        setError('Password is required');
        setLoading(false);
        return;
      }

      if (password.trim().length < 6) {
        setError('Password must be at least 6 characters');
        setLoading(false);
        return;
      }

      // Create client
      const phoneDigits = phone.trim().replace(/\D/g, '');
      const fullPhone = phoneDigits ? phoneCountryCode + phoneDigits : undefined;
      
      const clientRes = await api.post('/api/clients', {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: fullPhone,
        phoneCountryCode: phoneDigits ? phoneCountryCode : undefined,
      });

      const clientId = clientRes.data.client.id;
      setCreatedClientId(clientId);

      // Create password for client (required)
      try {
        await api.post('/api/clients/set-password', {
          clientId,
          password: password.trim(),
        });
      } catch (err) {
        console.error('Error setting client password:', err);
        setError('Failed to set client password');
        setLoading(false);
        return;
      }

      setActiveStep(1);
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to create client');
    } finally {
      setLoading(false);
    }
  };

  const assignSubscriptionToClient = async () => {
    try {
      setLoading(true);
      setError(null);

      await api.post('/api/clients/subscription/manual', {
        clientId: createdClientId,
        packageId: selectedPackageId,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to assign subscription');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const assignFormsToClient = async () => {
    try {
      setLoading(true);
      setError(null);

      const formsToAssign = [];
      if (selectedWorkoutFormId) formsToAssign.push(selectedWorkoutFormId);
      if (selectedNutritionFormId) formsToAssign.push(selectedNutritionFormId);

      for (const formId of formsToAssign) {
        await api.post('/api/forms/send', {
          formId,
          clientId: createdClientId,
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to assign forms');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const workoutForms = formTemplates.filter(f => f.type === 'workout');
  const nutritionForms = formTemplates.filter(f => f.type === 'nutrition');

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              Enter the basic information for the new client
            </Typography>
            <TextField
              fullWidth
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              autoFocus
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                // Debounce validation
                setTimeout(() => validateEmail(e.target.value), 500);
              }}
              error={!!emailError}
              helperText={emailError || (isValidatingEmail ? 'Checking...' : '')}
              required
            />
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <FormControl sx={{ minWidth: 220, flex: 1 }}>
                <Autocomplete
                  value={COUNTRY_CODES.find((country) => country.code === phoneCountryCode) ?? COUNTRY_CODES[0]}
                  onChange={(_event, newValue) => {
                    const nextCode = newValue?.code || COUNTRY_CODES[0].code;
                    setPhoneCountryCode(nextCode);
                    if (phone.trim()) {
                      setTimeout(() => validatePhone(phone), 100);
                    }
                  }}
                  options={COUNTRY_CODES}
                  filterOptions={filterCountryOptions}
                  getOptionLabel={(option) => `${option.flag} ${option.name} (${option.code})`}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Country Code"
                      placeholder="Search by name or code"
                    />
                  )}
                  renderOption={(props, option) => (
                    <li {...props}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <span>{option.flag}</span>
                        <Typography variant="body2">
                          {option.name} ({option.code})
                        </Typography>
                      </Stack>
                    </li>
                  )}
                />
              </FormControl>
              <TextField
                fullWidth
                label="Phone Number"
                value={phone}
                onChange={(e) => {
                  // Only allow digits
                  const digitsOnly = e.target.value.replace(/\D/g, '');
                  setPhone(digitsOnly);
                  // Debounce validation
                  setTimeout(() => validatePhone(digitsOnly), 500);
                }}
                error={!!phoneError}
                helperText={phoneError || (isValidatingPhone ? 'Checking...' : 'Enter phone number (digits only, 7-15 digits)')}
                inputProps={{ maxLength: 15 }}
              />
            </Stack>
            <TextField
              fullWidth
              label="Password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                validatePassword(e.target.value);
              }}
              error={!!passwordError}
              helperText={passwordError || "Set a password so the client can login to their portal (minimum 6 characters)"}
              required
            />
          </Stack>
        );

      case 1:
        return (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              Assign a subscription package to the client. The subscription will be in "pre-start" status until the first plan is delivered.
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={assignSubscription}
                  onChange={(e) => setAssignSubscription(e.target.checked)}
                />
              }
              label="Assign subscription to this client"
            />

            {assignSubscription && (
              <>
                {packages.length === 0 ? (
                  <Alert severity="warning">
                    No packages available. Please create packages first from the Client Packages page.
                  </Alert>
                ) : (
                  <FormControl fullWidth required={assignSubscription}>
                    <InputLabel>Select Package</InputLabel>
                    <Select
                      value={selectedPackageId}
                      label="Select Package"
                      onChange={(e) => setSelectedPackageId(e.target.value)}
                    >
                      {packages.map((pkg) => (
                        <MenuItem key={pkg.id} value={pkg.id}>
                          {pkg.name} - {pkg.durationMonths} month(s) - {pkg.priceCents / 100} {pkg.currency}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Alert severity="info">
                  The subscription will start in "pre-start" status and automatically activate when you deliver the first plan.
                </Alert>
              </>
            )}
          </Stack>
        );

      case 2:
        return (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              Assign assessment forms to the client to gather their information
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={assignForms}
                  onChange={(e) => setAssignForms(e.target.checked)}
                />
              }
              label="Assign forms to this client"
            />

            {assignForms && (
              <>
                {formTemplates.length === 0 ? (
                  <Alert severity="warning">
                    No form templates available. You can create forms later from the Forms page.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    <FormControl fullWidth>
                      <InputLabel>Nutrition Form (Optional)</InputLabel>
                      <Select
                        value={selectedNutritionFormId}
                        label="Nutrition Form (Optional)"
                        onChange={(e) => setSelectedNutritionFormId(e.target.value)}
                      >
                        <MenuItem value="">None</MenuItem>
                        {nutritionForms.map((form) => (
                          <MenuItem key={form.id} value={form.id}>
                            {form.title}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth>
                      <InputLabel>Workout Form (Optional)</InputLabel>
                      <Select
                        value={selectedWorkoutFormId}
                        label="Workout Form (Optional)"
                        onChange={(e) => setSelectedWorkoutFormId(e.target.value)}
                      >
                        <MenuItem value="">None</MenuItem>
                        {workoutForms.map((form) => (
                          <MenuItem key={form.id} value={form.id}>
                            {form.title}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>
                )}
              </>
            )}
          </Stack>
        );

      case 3:
        return (
          <Stack spacing={3} alignItems="center" textAlign="center">
            <CheckCircle sx={{ fontSize: 80, color: 'success.main' }} />
            <Typography variant="h6">Client Created Successfully!</Typography>
            <Typography variant="body2" color="text.secondary">
              The client has been set up and is ready to receive plans.
            </Typography>

            <Box sx={{ width: '100%', textAlign: 'left' }}>
              <List>
                <ListItem>
                  <ListItemIcon>
                    <CheckCircle color="success" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Client Account"
                    secondary={`${fullName} (${email})`}
                  />
                </ListItem>

                {assignSubscription && selectedPackageId && (
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Subscription Assigned"
                      secondary={
                        <Box>
                          <Typography variant="body2">
                            {packages.find(p => p.id === selectedPackageId)?.name}
                          </Typography>
                          <Chip label="Pre-Start" size="small" color="warning" sx={{ mt: 0.5 }} />
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            Will activate automatically when first plan is delivered
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                )}

                {assignForms && (selectedWorkoutFormId || selectedNutritionFormId) && (
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Forms Assigned"
                      secondary={
                        <Box>
                          {selectedNutritionFormId && (
                            <Chip
                              label={formTemplates.find(f => f.id === selectedNutritionFormId)?.title || 'Nutrition Form'}
                              size="small"
                              color="success"
                              sx={{ mr: 0.5, mt: 0.5 }}
                            />
                          )}
                          {selectedWorkoutFormId && (
                            <Chip
                              label={formTemplates.find(f => f.id === selectedWorkoutFormId)?.title || 'Workout Form'}
                              size="small"
                              color="primary"
                              sx={{ mr: 0.5, mt: 0.5 }}
                            />
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                )}
              </List>
            </Box>
          </Stack>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (activeStep) {
      case 0:
        return fullName.trim() && email.trim() && password.trim() && password.trim().length >= 6 && !emailError && !phoneError && !passwordError;
      case 1:
        return !assignSubscription || selectedPackageId;
      case 2:
        return true; // Forms are optional
      default:
        return true;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Client</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Box sx={{ minHeight: 300 }}>
            {renderStepContent(activeStep)}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => {
          handleReset();
          onClose();
        }}>
          Cancel
        </Button>
        {activeStep > 0 && activeStep < 3 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < 3 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed() || loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Next'}
          </Button>
        ) : (
          <Button variant="contained" onClick={handleComplete} color="success">
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

