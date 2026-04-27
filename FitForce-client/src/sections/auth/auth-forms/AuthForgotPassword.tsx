'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Formik } from 'formik';
import * as Yup from 'yup';
import { openSnackbar } from 'api/snackbar';
import AnimateButton from 'components/@extended/AnimateButton';
import useScriptRef from 'hooks/useScriptRef';
import useUser from 'hooks/useUser';
import api from '@/utils/axios';
import { SnackbarProps } from 'types/snackbar';

type Stage = 'request' | 'verify';

export default function AuthForgotPassword() {
  const scriptedRef = useScriptRef();
  const router = useRouter();
  const user = useUser();
  const [stage, setStage] = useState<Stage>('request');
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSendEmail = async (values: { email: string }, helpers: any) => {
    const { setErrors, setStatus, setSubmitting } = helpers;
    try {
      const trimmedEmail = values.email.trim().toLowerCase();
      await api.post('/api/auth/password/forgot', { email: trimmedEmail });
      setSubmittedEmail(trimmedEmail);
      setStage('verify');
      setStatus({ success: true });
      setSubmitting(false);
      openSnackbar({
        open: true,
        message: 'If an account exists, a verification code was sent to your email.',
        variant: 'alert',
        alert: {
          color: 'success'
        }
      } as SnackbarProps);
    } catch (err: any) {
      if (scriptedRef.current) {
        const message = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to send reset email';
        setStatus({ success: false });
        setErrors({ submit: message });
        setSubmitting(false);
        openSnackbar({
          open: true,
          message,
          variant: 'alert',
          alert: {
            color: 'error'
          }
        } as SnackbarProps);
      }
    }
  };

  const handleResetPassword = async (values: { code: string; newPassword: string; confirmPassword: string }, helpers: any) => {
    const { setErrors, setStatus, setSubmitting } = helpers;
    try {
      await api.post('/api/auth/password/reset', {
        email: submittedEmail,
        code: values.code,
        newPassword: values.newPassword
      });

      setStatus({ success: true });
      setSubmitting(false);
      openSnackbar({
        open: true,
        message: 'Password reset successfully. You can now log in.',
        variant: 'alert',
        alert: {
          color: 'success'
        }
      } as SnackbarProps);
      setTimeout(() => {
        router.push(user ? '/auth/login' : '/login');
      }, 1200);
    } catch (err: any) {
      if (scriptedRef.current) {
        const message = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to reset password';
        setStatus({ success: false });
        setErrors({ submit: message });
        setSubmitting(false);
        openSnackbar({
          open: true,
          message,
          variant: 'alert',
          alert: {
            color: 'error'
          }
        } as SnackbarProps);
      }
    }
  };

  return (
    <>
      {stage === 'request' && (
        <Formik
          initialValues={{ email: '', submit: null }}
          validationSchema={Yup.object().shape({
            email: Yup.string().email('Must be a valid email').max(255).required('Email is required')
          })}
          onSubmit={handleSendEmail}
        >
          {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
            <form noValidate onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid size={12}>
                  <Stack sx={{ gap: 1 }}>
                    <InputLabel htmlFor="email-forgot">Email Address</InputLabel>
                    <OutlinedInput
                      fullWidth
                      error={Boolean(touched.email && errors.email)}
                      id="email-forgot"
                      type="email"
                      value={values.email}
                      name="email"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="Enter email address"
                    />
                  </Stack>
                  {touched.email && errors.email && (
                    <FormHelperText error id="helper-text-email-forgot">
                      {errors.email}
                    </FormHelperText>
                  )}
                </Grid>
                {errors.submit && (
                  <Grid size={12}>
                    <FormHelperText error>{errors.submit}</FormHelperText>
                  </Grid>
                )}
                <Grid sx={{ mb: -2 }} size={12}>
                  <Typography variant="caption">We'll send a 6-digit code if the email exists. Check your spam folder.</Typography>
                </Grid>
                <Grid size={12}>
                  <AnimateButton>
                    <Button disableElevation disabled={isSubmitting} fullWidth size="large" type="submit" variant="contained" color="primary">
                      Send Verification Code
                    </Button>
                  </AnimateButton>
                </Grid>
              </Grid>
            </form>
          )}
        </Formik>
      )}

      {stage === 'verify' && (
        <Formik
          enableReinitialize
          initialValues={{ code: '', newPassword: '', confirmPassword: '', submit: null }}
          validationSchema={Yup.object().shape({
            code: Yup.string().matches(/^\d{6}$/, 'Enter the 6-digit code').required('Verification code is required'),
            newPassword: Yup.string().min(6, 'Password must be at least 6 characters').required('New password is required'),
            confirmPassword: Yup.string()
              .oneOf([Yup.ref('newPassword')], 'Passwords must match')
              .required('Confirm your new password')
          })}
          onSubmit={handleResetPassword}
        >
          {({ errors, handleBlur, handleChange, handleSubmit, isSubmitting, touched, values }) => (
            <form noValidate onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid size={12}>
                  <Stack sx={{ gap: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Code sent to
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {submittedEmail}
                    </Typography>
                    <Button
                      type="button"
                      variant="text"
                      size="small"
                      sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                      onClick={() => {
                        setStage('request');
                        setSubmittedEmail('');
                      }}
                    >
                      Use a different email
                    </Button>
                  </Stack>
                </Grid>

                <Grid size={12}>
                  <Stack sx={{ gap: 1 }}>
                    <InputLabel htmlFor="code">Verification Code</InputLabel>
                    <OutlinedInput
                      fullWidth
                      error={Boolean(touched.code && errors.code)}
                      id="code"
                      name="code"
                      value={values.code}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="Enter 6-digit code"
                    />
                  </Stack>
                  {touched.code && errors.code && (
                    <FormHelperText error id="helper-text-code">
                      {errors.code}
                    </FormHelperText>
                  )}
                </Grid>

                <Grid size={12}>
                  <Stack sx={{ gap: 1 }}>
                    <InputLabel htmlFor="new-password">New Password</InputLabel>
                    <OutlinedInput
                      fullWidth
                      error={Boolean(touched.newPassword && errors.newPassword)}
                      id="new-password"
                      type="password"
                      name="newPassword"
                      value={values.newPassword}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="Enter new password"
                    />
                  </Stack>
                  {touched.newPassword && errors.newPassword && (
                    <FormHelperText error id="helper-text-new-password">
                      {errors.newPassword}
                    </FormHelperText>
                  )}
                </Grid>

                <Grid size={12}>
                  <Stack sx={{ gap: 1 }}>
                    <InputLabel htmlFor="confirm-password">Confirm Password</InputLabel>
                    <OutlinedInput
                      fullWidth
                      error={Boolean(touched.confirmPassword && errors.confirmPassword)}
                      id="confirm-password"
                      type="password"
                      name="confirmPassword"
                      value={values.confirmPassword}
                      onBlur={handleBlur}
                      onChange={handleChange}
                      placeholder="Re-enter new password"
                    />
                  </Stack>
                  {touched.confirmPassword && errors.confirmPassword && (
                    <FormHelperText error id="helper-text-confirm-password">
                      {errors.confirmPassword}
                    </FormHelperText>
                  )}
                </Grid>

                {errors.submit && (
                  <Grid size={12}>
                    <FormHelperText error>{errors.submit}</FormHelperText>
                  </Grid>
                )}

                <Grid size={12}>
                  <AnimateButton>
                    <Button disableElevation disabled={isSubmitting} fullWidth size="large" type="submit" variant="contained" color="primary">
                      Reset Password
                    </Button>
                  </AnimateButton>
                </Grid>
              </Grid>
            </form>
          )}
        </Formik>
      )}
    </>
  );
}
