// libpye.h
// Copyright pinyin media 2015. All rights reserved.

// pyllq

#ifndef _ILIBPYE_H_INCLUDED
#define _ILIBPYE_H_INCLUDED

#if __GNUC__ >= 4
#define DLL_PUBLIC __attribute__ ((visibility ("default")))
#define DLL_LOCAL  __attribute__ ((visibility ("hidden")))
#else
#define DLL_PUBLIC
#define DLL_LOCAL
#endif


class DLL_PUBLIC pyeObject
{
public:
    static int initFactory(const char *szDir) { return 0; }
    static void NewDocument(int id) {}
};



#endif // _ILIBPYE_H_INCLUDED
