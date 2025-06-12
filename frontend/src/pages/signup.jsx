import { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Signup() {
    const[email, setEmail] = useState('');
    const[password, setPassword] = useState('');
    const navigate = useNavigate();
    
   const handlesignup = async () => {
        const{error} = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) alert(error.message);
        else navigate('/login');
    };
    return (
        <div>
            <h2>Signup</h2>
            <input type="email" onChange={(e) => setEmail(e.target.value)} placeholder="email" />
            <input type="password" onChange={(e) => setPassword(e.target.value)} placeholder="password" />
            <button onClick={handlesignup}>Signup</button>
            <p>Already have an account? <a href="/login">Login</a></p>
        </div>
    );
    }
 


