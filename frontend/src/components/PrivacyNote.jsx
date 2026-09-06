function PrivacyNote() {
  return (
    <p className="mx-auto mt-4 max-w-md text-center text-xs leading-normal text-scanora-muted">
      <svg
        className="mr-1.5 -mt-0.5 inline-block h-3.5 w-3.5 align-middle text-scanora-primary"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
      <span>No account required • Reports are analyzed in-session only and never stored</span>
    </p>
  )
}

export default PrivacyNote
