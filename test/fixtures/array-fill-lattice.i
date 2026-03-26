Array fill lattice test
C Outer container
1  0  -1   FILL=1  IMP:N=1
C Lattice cell with 2x2 array fill
2  0  -2   U=1 LAT=1 FILL=0:1 0:1 0:0
     10 20 30 40       IMP:N=1
C Fill universes
10  1  -1.0  -3  U=10 IMP:N=1
11  0   3  U=10 IMP:N=0
20  1  -1.0  -3  U=20 IMP:N=1
21  0   3  U=20 IMP:N=0
30  1  -1.0  -3  U=30 IMP:N=1
31  0   3  U=30 IMP:N=0
40  1  -1.0  -3  U=40 IMP:N=1
41  0   3  U=40 IMP:N=0
C Outside
99  0  1  IMP:N=0

1  RPP -10 10 -10 10 -5 5
2  RPP -5 5 -5 5 -5 5
3  SO 2

M1  1001.80c 2 8016.80c 1
