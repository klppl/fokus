"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { registrationSchema } from "@/schema";
import { useRouter } from "@/i18n/navigation";
import { useToast } from "@/hooks/use-toast";
import Spinner from "@/components/ui/spinner";
import EyeToggle from "@/components/ui/eyeToggle";

type RegisterForm = {
  fname: string;
  lname?: string;
  email: string;
  password: string;
};

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: (values) => {
      const result = registrationSchema.safeParse(values);
      if (result.success) return { values: result.data, errors: {} };
      const fieldErrors: Record<string, { type: string; message: string }> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as string;
        if (!fieldErrors[field]) fieldErrors[field] = { type: issue.code, message: issue.message };
      }
      return { values: {}, errors: fieldErrors };
    },
  });

  const router = useRouter();
  const { toast } = useToast();
  const [show, setShow] = useState(false);

  async function onSubmit(data: RegisterForm) {
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        toast({ title: result.message || "Registration failed" });
        return;
      }

      toast({ title: "Account created", description: "You can now log in." });
      router.push("/login");
    } catch (error) {
      console.error(error);
      toast({ title: "Something went wrong" });
    }
  }

  return (
    <div className="flex min-w-screen min-h-screen justify-center items-center bg-muted">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="z-50 w-screen h-screen bg-form-background md:w-[70%] md:h-fit lg:w-[60%] xl:w-[50%] 2xl:w-[38%] md:rounded-xl p-[55px] md:p-[85px] shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.1),0_4px_8px_rgba(0,0,0,0.15),0_8px_16px_rgba(0,0,0,0.15),0_16px_32px_rgba(0,0,0,0.2)]"
      >
        <h1 className="text-[35px] md:text-[38px] lg:text-[45px] text-white mb-[37px]">
          Create Account
        </h1>

        <div className="flex flex-col gap-[43px] mb-[40px]">
          {/* Name */}
          <div>
            <input
              {...register("fname")}
              type="text"
              placeholder="Name"
              className="text-white bg-form-input rounded-md h-[45px] w-full px-[18px] focus:outline-hidden focus:outline-form-border"
            />
            {errors.fname && (
              <p className="text-sm text-white mt-3">{errors.fname.message}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <input
              {...register("email")}
              type="text"
              placeholder="Email"
              className="text-white bg-form-input rounded-md h-[45px] w-full px-[18px] focus:outline-hidden focus:outline-form-border"
            />
            {errors.email && (
              <p className="text-sm text-white mt-3">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="relative h-[45px]">
              <input
                {...register("password")}
                type={show ? "text" : "password"}
                placeholder="Password"
                className="absolute inset-0 z-0 text-white bg-form-input rounded-md w-full px-[18px] pr-[55px] focus:outline-hidden focus:outline-form-border"
              />
              <EyeToggle show={show} setShow={setShow} />
            </div>
            {errors.password && (
              <p className="text-sm text-white mt-3">
                {errors.password.message}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-7">
          <button
            disabled={isSubmitting}
            className="flex justify-center items-center gap-2 bg-form-button rounded-md text-white px-[18px] h-11 w-full hover:bg-form-button-accent transition-all duration-300"
          >
            {isSubmitting && <Spinner className="w-7 h-7" />}
            Create Account
          </button>
        </div>
      </form>
    </div>
  );
}
