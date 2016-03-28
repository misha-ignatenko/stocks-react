Correlation-One Challenge Info

Instructions
Click the "Enter Prices" button and enter the sample csv data from the Google Doc into the text box:
---
https://docs.google.com/document/d/10R5SLzweoFGb5z6s9Ul7eLNhYrJgmODK1ObXb0gjj9c/edit?pref=2&pli=1

You will see the text box and csv values turn into a table where column 1 has date and all other columns have open-to-close price changes in percents. The first 50 rows of data have values in column 2 (S1), and the last 50 rows of data have empty cell in column 2 (S1).

The pre-set values for tolerance, max iter, and step size are based on the research I have done (see below).
---
Tolerance refers to gradient sum of squares that determines whether gradient descent converges.

Locate and click the "Predict" button below the table.
---


Predictions will take a few seconds and will appear at the bottom of the page in csv format.
---

4 Questions
---
1. S2...S10 are relevant in predicting S1. I believe that if we use S1 in predicting S1, we might run into the issue of overfitting our solution. I implemented the simplest multiple regression gradient descent algorithm in which I considered S2...S10 from the same day to get weights for each S2...S10 that factor into S1 (plus a random noise constant, which I set to 0.001).

2. Assuming that every next day's open price is the same as previous day's close price, based on my predictions the total price increased by 4.943480167% from 08-11-2014 to 10-21-2014.

3. While running several regressions and analyzing results I noticed that, as I was decreasing tolerance and increasing the number of maximum allowed iterations, the weight of S6 started to go up significantly, while the weights for S2,...,S5,S7,...S10 all remained relatively stable. I might have overfitted the model to rely too much on S6, but I still have overall confidence in the model.
Here are the weights that I got from my model (the first weight is for the 0.001 noise parameter, the second weight is for S2, the third for S3, etc.): [0.08437538723994861,-0.23520298895145317,0.0835870197105594,-0.056339223469445705,0.07410998120446002,0.26328066062683103,0.1352465854784302,-0.18387878019730358,-0.04397078623929067,-0.0052832452373803565]. The RSS of the model and all 50 items of the training set is: 4.211200706086055.



4. I used multiple gradient descent because I believe it's the simplest algorithm for this problem. If given more time I could implement more complex algorithms such as: 

1) Ridge

2) k-NN

3) Kernel

4) add seasonality since some prices can be cyclical

5) k-fold validation

6) composite variables such as some stock's % change cubed (cubed to retain the +/- sign) or cubic root-ed or one stock's % change multiplied by other stock's % change, % change over the past few days (not just 1 day)

7) closed-form solution for multiple regression instead and compare it to gradient descent

8) automatically re-run regressions to find the most optimal combination of tolerance, step size and max iter (instead of doing it manually)


Research Steps
---
To get the best model I tried running different combinations of tolerance (regression convergence parameter), max allowable number of iterations inside regression algorithm, and step size for gradient descent. You can see all the combinations I tried on lines 276-312 (commented out) of client/components/correlation-one/CorrelationOne.jsx file. I also tried to use the ideas behind Lasso regression by eliminating stocks whose weights are relatively insignificant to other stocks' weights in predicting S1 (lines 366-371) but this did not lead to a better RSS -- I tried to exclude some possible combinations of S4, S9, and S10 from the model because their weights were the smallest compared to other stocks.
