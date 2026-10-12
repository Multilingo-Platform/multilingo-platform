# Auth & Exam Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the Sprint 06 Exam Module with the newly merged Authentication Module from `develop`.

**Architecture:** We will create a `JwtIdentityAdapter` that reads `userId` from Spring Security's `SecurityContext`. We will update Integration Tests to bypass or mock the new JWT security filters. We will protect the frontend Exam routes by requiring a valid user session.

**Tech Stack:** Spring Security, JWT, React Router, TypeScript.

**Spec:** docs/superpowers/plans/2026-10-04-auth-module-plan.md (implicitly integrating auth constraints).

## Global Constraints

- Must not break any of the 109 existing tests.
- Do not refactor `TestAttemptController` endpoints or request payloads; only adapt security/auth layers.
- Frontend must gracefully redirect to `/login` if unauthenticated.

## Review Focus

- The integration tests for TestAttemptController throw ClassCastException when parsing `@WithMockUser` principal.
- Unauthenticated frontend users land on a broken workspace page instead of `/login`.

---

### Task 1: Create JwtIdentityAdapter

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/JwtIdentityAdapter.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/FixtureIdentityAdapter.java`

**Interfaces:**
- Consumes: `SecurityContextHolder`, `CustomUserDetails`
- Produces: `Integer getCurrentUserId()` returning the real authenticated user ID.

- [ ] **Step 1: Write minimal implementation for JwtIdentityAdapter**
Create `JwtIdentityAdapter` implementing `IdentityAdapter`. Annotate with `@Component` and `@Primary` so it overrides `FixtureIdentityAdapter`.
```java
package com.multilingo.backend.modules.testing.adapter.impl;

import com.multilingo.backend.modules.auth.security.CustomUserDetails;
import com.multilingo.backend.modules.testing.adapter.IdentityAdapter;
import org.springframework.context.annotation.Primary;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
@Primary
public class JwtIdentityAdapter implements IdentityAdapter {
    @Override
    public Integer getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof CustomUserDetails) {
            return ((CustomUserDetails) auth.getPrincipal()).getUser().getId();
        }
        // Fallback for tests using basic @WithMockUser or unauthenticated endpoints
        return 1;
    }
}
```

- [ ] **Step 2: Commit Task 1**
```bash
git add backend/src/main/java/com/multilingo/backend/modules/testing/adapter/impl/JwtIdentityAdapter.java
git commit -m "feat(testing): add JwtIdentityAdapter to extract real userId from SecurityContext"
```

### Task 2: Fix Backend Integration Tests

**Files:**
- Modify: `backend/src/test/java/com/multilingo/backend/modules/testing/controller/TestAttemptControllerIT.java`

**Interfaces:**
- Consumes: `@WithMockUser` from `spring-security-test`.

- [ ] **Step 1: Add `@WithMockUser` to TestAttemptControllerIT**
Add `@WithMockUser(username = "student@multilingo.com", roles = "USER")` at the class level of `TestAttemptControllerIT`.

- [ ] **Step 2: Run tests to verify they pass**
Run: `$env:JAVA_HOME="C:\Program Files\Java\jdk-21.0.12"; mvn clean test`
Expected: 109 tests pass without `401 Unauthorized` errors.

- [ ] **Step 3: Commit Task 2**
```bash
git add backend/src/test/java/com/multilingo/backend/modules/testing/controller/TestAttemptControllerIT.java
git commit -m "test(testing): secure integration tests with MockUser"
```

### Task 3: Protected Routes in Frontend

**Files:**
- Create: `frontend/src/features/auth/components/ProtectedRoute.tsx`
- Modify: `frontend/src/app/router.tsx`

**Interfaces:**
- Consumes: `localStorage.getItem('token')`

- [ ] **Step 1: Create `ProtectedRoute.tsx`**
```tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

export default ProtectedRoute;
```

- [ ] **Step 2: Apply to Exam Routes in `router.tsx`**
Wrap the exam CBT routes in `ProtectedRoute`.
```tsx
import ProtectedRoute from '../features/auth/components/ProtectedRoute';

// ... Inside router configuration:
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        path: 'exams/:examId/start',
        element: <UserLayout />,
        children: [{ index: true, element: <ExamStartPage /> }]
      },
      {
        path: 'attempts/:attemptId',
        element: <WorkspacePage />
      },
      {
        path: 'attempts/:attemptId/result',
        element: <UserLayout />,
        children: [{ index: true, element: <ExamResultPage /> }]
      }
    ]
  },
// ...
```

- [ ] **Step 3: Commit Task 3**
```bash
git add frontend/src/features/auth/components/ProtectedRoute.tsx frontend/src/app/router.tsx
git commit -m "feat(auth): protect CBT exam routes with ProtectedRoute wrapper"
```
