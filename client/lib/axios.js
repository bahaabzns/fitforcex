import axios from 'axios';

const api = axios.create({
    baseURL : process.env.NEXT_PUBLIC_API_URL, withCredentials: true
});

// The landing page embeds the real client portal in an iframe named "ff-demo". Inside that
// frame only, every API call is answered from recorded demo data instead of the network.
export function isDemoFrame() {
    return typeof window !== 'undefined' && window.name === 'ff-demo' && window.self !== window.top;
}

if (isDemoFrame()) {
    api.defaults.adapter = (config) => import('@/lib/demo/adapter').then((module) => module.demoAdapter(config));
}

export default api;
