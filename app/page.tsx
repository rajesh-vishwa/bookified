import BookCard from "@/components/BookCard";
import HeroSection from "@/components/HeroSection";
import { BookCardProps } from "@/types";
import React from "react";

const books: BookCardProps[] = [
  {
    _id: 1,
    title: "Clean Code",
    author: "Robert C. Martin",
    coverURL: "https://covers.openlibrary.org/b/id/15126503-M.jpg",
    slug: "clean-code",
  },
  {
    _id: 2,
    title: "Exploring TypeScript",
    author: "Rajesh Vishwakarma",
    coverURL: "https://covers.openlibrary.org/b/id/15097855-M.jpg",
    slug: "exploring-typescript",
  },
  {
    _id: 3,
    title: "Java Programming",
    author: "Brett Spell",
    coverURL: "https://covers.openlibrary.org/b/id/916256-M.jpg",
    slug: "java-programming",
  },
  {
    _id: 4,
    title: "Oracle JDeveloper 3 handbook",
    author: "Paul Dorsey",
    coverURL: "https://covers.openlibrary.org/b/id/61309-M.jpg",
    slug: "oracle-jdeveloper-3-handbook",
  },
  {
    _id: 5,
    title: "Development as freedom",
    author: "Amartya Sen",
    coverURL: "https://covers.openlibrary.org/b/id/15147340-M.jpg",
    slug: "development-as-freedom",
  },
  {
    _id: 6,
    title: "Origami Omnibus",
    author: "Manish Jain",
    coverURL: "https://covers.openlibrary.org/b/id/12266240-M.jpg",
    slug: "oracle-jdeveloper-3-handbook",
  },
  {
    _id: 7,
    title: "Oracle JDeveloper 3 handbook",
    author: "Paul Dorsey",
    coverURL: "https://covers.openlibrary.org/b/id/61309-M.jpg",
    slug: "oracle-jdeveloper-3-handbook",
  },
];
const page = () => {
  return (
    <main className="wrapper container">
      <HeroSection />
      <div className="library-books-grid">
        {books.map((book) => (
          <BookCard
            key={book._id}
            title={book.title}
            author={book.author}
            coverURL={book.coverURL}
            slug={book.slug}
          />
        ))}
      </div>
    </main>
  );
};

export default page;
